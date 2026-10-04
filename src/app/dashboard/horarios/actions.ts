"use server";

import { crearClienteServidor } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const RUTA = "/dashboard/horarios";

// Mismo patrón que servicios/actions.ts: las acciones que llama un
// formulario con useActionState NO hacen throw — devuelven { error } como
// dato, así un error se muestra en el formulario en vez de tirar abajo la
// página (pantalla roja de Next).
export type EstadoAccion = { error: string | null };

// Error "esperable" (validación, negocio inexistente): el mensaje se le
// muestra tal cual al usuario.
class ErrorDeUsuario extends Error {}

function aEstado(e: unknown): EstadoAccion {
  if (e instanceof ErrorDeUsuario) return { error: e.message };
  console.error(e);
  return { error: "Ocurrió un error inesperado. Probá de nuevo." };
}

// Mismo patrón que servicios/actions.ts: RLS ("negocio administra su
// disponibilidad / sus bloqueos") ya exige negocio_id = negocio_actual(),
// acá solo lo buscamos para poder completar la columna en el insert.
async function obtenerNegocio() {
  const supabase = await crearClienteServidor();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ErrorDeUsuario("No autenticado.");

  const { data: negocio } = await supabase
    .from("negocios")
    .select("id")
    .single();
  if (!negocio) throw new ErrorDeUsuario("No se encontró el negocio de esta cuenta.");

  return { supabase, negocioId: negocio.id as string };
}

// <input type="time"> devuelve "HH:MM"; comparar strings con ese formato
// fijo es equivalente a comparar horas.
function leerHora(formData: FormData, campo: string) {
  const valor = String(formData.get(campo) ?? "");
  if (!/^\d{2}:\d{2}$/.test(valor)) throw new ErrorDeUsuario("Hora inválida.");
  return valor;
}

// ── Horario semanal (tabla disponibilidad) ──────────────────────────────
export async function crearFranja(
  _estadoPrevio: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const { supabase, negocioId } = await obtenerNegocio();

    const dia_semana = Number(formData.get("dia_semana"));
    const hora_desde = leerHora(formData, "hora_desde");
    const hora_hasta = leerHora(formData, "hora_hasta");

    if (!Number.isInteger(dia_semana) || dia_semana < 0 || dia_semana > 6) {
      return { error: "Día inválido." };
    }
    if (hora_desde >= hora_hasta) {
      return { error: "La hora de inicio tiene que ser anterior a la de fin." };
    }

    const { error } = await supabase.from("disponibilidad").insert({
      negocio_id: negocioId,
      dia_semana,
      hora_desde,
      hora_hasta,
    });

    if (error) {
      // 23P01 = exclusion_violation: la constraint disponibilidad_sin_solapes
      // (migración 0002) detectó que se pisa con otra franja del mismo día.
      if (error.code === "23P01") {
        return { error: "Esa franja se superpone con otra que ya cargaste ese día." };
      }
      return { error: error.message };
    }

    revalidatePath(RUTA);
    return { error: null };
  } catch (e) {
    return aEstado(e);
  }
}

export async function borrarFranja(franjaId: string) {
  const supabase = await crearClienteServidor();

  const { error } = await supabase.from("disponibilidad").delete().eq("id", franjaId);
  if (error) throw new Error(error.message);

  revalidatePath(RUTA);
}

// ── Bloqueos puntuales (feriados, vacaciones, un trámite) ───────────────
export async function crearBloqueo(
  _estadoPrevio: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const { supabase, negocioId } = await obtenerNegocio();

    const fecha = String(formData.get("fecha") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Fecha inválida." };

    // "Todo el día" = 00:00–23:59, igual criterio que turnos-bot para el
    // fin de día (time no admite cómodamente 24:00 desde un input).
    const todoElDia = formData.get("todo_el_dia") === "on";
    const hora_desde = todoElDia ? "00:00" : leerHora(formData, "hora_desde");
    const hora_hasta = todoElDia ? "23:59" : leerHora(formData, "hora_hasta");

    if (hora_desde >= hora_hasta) {
      return { error: "La hora de inicio tiene que ser anterior a la de fin." };
    }

    const motivo = String(formData.get("motivo") ?? "").trim() || null;

    const { error } = await supabase.from("bloqueos").insert({
      negocio_id: negocioId,
      fecha,
      hora_desde,
      hora_hasta,
      motivo,
    });

    if (error) return { error: error.message };

    revalidatePath(RUTA);
    return { error: null };
  } catch (e) {
    return aEstado(e);
  }
}

export async function borrarBloqueo(bloqueoId: string) {
  const supabase = await crearClienteServidor();

  const { error } = await supabase.from("bloqueos").delete().eq("id", bloqueoId);
  if (error) throw new Error(error.message);

  revalidatePath(RUTA);
}
