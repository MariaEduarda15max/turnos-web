"use server";

import { crearClientePublico } from "@/lib/supabase/publico";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esHoraValida, fechaMontevideo } from "@/lib/fechas";
import { cobroOnline, crearPreferencia, SITIO_URL, tokenDelNegocio } from "@/lib/mp";

export type EstadoReserva = {
  error: string | null;
  tokenAcceso: string | null;
  // Si hay que pagar: a dónde mandar al cliente (Checkout Pro de MP).
  linkPago: string | null;
};

const estadoInicial: EstadoReserva = { error: null, tokenAcceso: null, linkPago: null };

// Cuánto tiempo se retiene el horario mientras el cliente paga.
const MINUTOS_RETENCION = 15;

export async function reservarTurno(
  _estadoPrevio: EstadoReserva,
  formData: FormData,
): Promise<EstadoReserva> {
  const supabase = crearClientePublico();

  const negocioId = String(formData.get("negocioId") ?? "");
  const servicioId = String(formData.get("servicioId") ?? "");
  const dia = String(formData.get("dia") ?? "");
  const hora = String(formData.get("hora") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  // En minúsculas: Supabase Auth guarda así los emails, y vincular_cliente()
  // compara contra el email de la cuenta.
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const telefono = String(formData.get("telefono") ?? "").trim();

  if (!nombre || (!email && !telefono)) {
    return { ...estadoInicial, error: "Nombre y (email o teléfono) son obligatorios." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !esHoraValida(hora)) {
    return { ...estadoInicial, error: "Fecha u hora inválida. Volvé a elegir el horario." };
  }

  // El servicio TIENE que ser de este negocio — sin este chequeo, alguien
  // podría mandar un servicio_id de otro negocio a mano.
  const { data: servicio } = await supabase
    .from("servicios")
    .select("id, duracion_min")
    .eq("id", servicioId)
    .eq("negocio_id", negocioId)
    .maybeSingle();

  if (!servicio) return { ...estadoInicial, error: "Servicio inválido." };

  // ¿Quien reserva tiene sesión de CLIENTE? Entonces el turno va a su
  // cuenta (si no, no aparecería en "Mis turnos" hasta el próximo login).
  // vincular_cliente() exige email confirmado, adopta filas de invitado y
  // devuelve el id de SU fila de cliente — nunca uno elegido por el form.
  // Un DUEÑO de negocio logueado se trata como invitado: si reserva para
  // otra persona, el turno no tiene que quedar en su cuenta.
  let clienteId: string | null = null;
  const supabaseSesion = await crearClienteServidor();
  const { data: { user } } = await supabaseSesion.auth.getUser();
  if (user) {
    const { data: esDueno } = await supabaseSesion.from("negocios").select("id").maybeSingle();
    if (!esDueno) {
      const { data: idCuenta } = await supabaseSesion.rpc("vincular_cliente", {
        negocio_id_param: negocioId,
      });
      if (typeof idCuenta === "string") clienteId = idCuenta;
    }
  }

  // Sin sesión (o si la vinculación falló): reserva como invitado. Reusa
  // una fila de invitado con el mismo email en ESTE negocio para no crear
  // una fila nueva en cada reserva; limit(1) porque podría haber varias
  // de antes y maybeSingle() fallaría con más de una.
  if (!clienteId) {
    const { data: invitados } = email
      ? await supabase
          .from("clientes")
          .select("id")
          .eq("negocio_id", negocioId)
          .eq("email", email)
          .is("auth_user_id", null)
          .order("creado_en")
          .limit(1)
      : { data: null };

    if (invitados && invitados.length > 0) {
      clienteId = invitados[0].id as string;
    } else {
      const { data: clienteNuevo, error: errorCliente } = await supabase
        .from("clientes")
        .insert({ negocio_id: negocioId, nombre, email: email || null, telefono: telefono || null })
        .select("id")
        .single();

      if (errorCliente || !clienteNuevo) {
        return { ...estadoInicial, error: "No se pudo registrar el cliente." };
      }
      clienteId = clienteNuevo.id as string;
    }
  }

  const inicio = fechaMontevideo(dia, hora);

  // Libera las reservas de otros que vencieron sin pagar: si no, seguirían
  // bloqueando el horario hasta que alguien las limpie (0011_cobro_online).
  await supabase.rpc("liberar_turnos_vencidos", { negocio_id_param: negocioId });

  // ¿Se cobra online? Se calcula de nuevo acá (no se confía en el form).
  const cobro = await cobroOnline(negocioId, servicioId);
  const venceEn = new Date(Date.now() + MINUTOS_RETENCION * 60_000);

  const { data: turno, error: errorTurno } = await supabase
    .from("turnos")
    .insert({
      negocio_id: negocioId,
      cliente_id: clienteId,
      servicio_id: servicioId,
      inicio: inicio.toISOString(),
      duracion_min: servicio.duracion_min,
      ...(cobro ? { estado: "pendiente_pago", expira_en: venceEn.toISOString() } : {}),
    })
    .select("id, token_acceso")
    .single();

  if (errorTurno || !turno) {
    // El constraint anti-solapamiento (0001_init.sql) puede rechazar el
    // insert si alguien tomó ese horario en el instante entre elegir el
    // slot y confirmar — misma carrera que en turnos-bot.
    if (errorTurno?.code === "23P01") {
      return {
        ...estadoInicial,
        error: "Uy, justo se ocupó ese horario. Elegí otro.",
      };
    }
    return { ...estadoInicial, error: errorTurno?.message ?? "No se pudo reservar el turno." };
  }

  if (!cobro) return { error: null, tokenAcceso: turno.token_acceso, linkPago: null };

  // Hay que cobrar: preferencia de Checkout Pro con el token DEL NEGOCIO
  // (la plata va a su cuenta). Si MP falla, se borra la reserva retenida
  // para no dejar el horario bloqueado 15 minutos por nada.
  try {
    const token = await tokenDelNegocio(negocioId);
    if (!token) throw new Error("El negocio no tiene Mercado Pago conectado");

    const preferencia = await crearPreferencia(token.accessToken, {
      negocioId,
      turnoId: turno.id,
      titulo: `${cobro.esSena ? "Seña · " : ""}${cobro.servicioNombre} · ${cobro.negocioNombre}`.slice(0, 250),
      monto: cobro.monto,
      emailPagador: email || null,
      venceEn,
      urlVuelta: `${SITIO_URL}/r/${negocioId}/turno/${turno.token_acceso}`,
    });

    await supabase
      .from("turnos")
      .update({ mp_preferencia_id: preferencia.id, link_pago: preferencia.linkPago })
      .eq("id", turno.id);

    return { error: null, tokenAcceso: turno.token_acceso, linkPago: preferencia.linkPago };
  } catch (e) {
    console.error("[reserva] no se pudo crear el pago:", e instanceof Error ? e.message : e);
    await supabase.from("turnos").delete().eq("id", turno.id).eq("estado", "pendiente_pago");
    return { ...estadoInicial, error: "No se pudo iniciar el pago. Probá de nuevo en un momento." };
  }
}