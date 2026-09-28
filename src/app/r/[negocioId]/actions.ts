"use server";

import { crearClientePublico } from "@/lib/supabase/publico";
import { fechaMontevideo } from "@/lib/fechas";

export type EstadoReserva = { error: string | null; tokenAcceso: string | null };

const estadoInicial: EstadoReserva = { error: null, tokenAcceso: null };

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
  const email = String(formData.get("email") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();

  if (!nombre || (!email && !telefono)) {
    return { ...estadoInicial, error: "Nombre y (email o teléfono) son obligatorios." };
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

  // Busca un cliente sin cuenta ya cargado con el mismo email dentro de
  // ESTE negocio, para no crear una fila de cliente nueva en cada reserva
  // de la misma persona — si no existe, se crea.
  let clienteId: string;
  const { data: clienteExistente } = email
    ? await supabase
        .from("clientes")
        .select("id")
        .eq("negocio_id", negocioId)
        .eq("email", email)
        .is("auth_user_id", null)
        .maybeSingle()
    : { data: null };

  if (clienteExistente) {
    clienteId = clienteExistente.id;
  } else {
    const { data: clienteNuevo, error: errorCliente } = await supabase
      .from("clientes")
      .insert({ negocio_id: negocioId, nombre, email: email || null, telefono: telefono || null })
      .select("id")
      .single();

    if (errorCliente || !clienteNuevo) {
      return { ...estadoInicial, error: "No se pudo registrar el cliente." };
    }
    clienteId = clienteNuevo.id;
  }

  const inicio = fechaMontevideo(dia, hora);

  const { data: turno, error: errorTurno } = await supabase
    .from("turnos")
    .insert({
      negocio_id: negocioId,
      cliente_id: clienteId,
      servicio_id: servicioId,
      inicio: inicio.toISOString(),
      duracion_min: servicio.duracion_min,
    })
    .select("token_acceso")
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

  return { error: null, tokenAcceso: turno.token_acceso };
}