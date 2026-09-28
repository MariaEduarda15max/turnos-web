"use server";

import { crearClientePublico } from "@/lib/supabase/publico";
import { fechaMontevideo } from "@/lib/fechas";

export type EstadoAccionToken = { error: string | null; ok: boolean };

const estadoInicial: EstadoAccionToken = { error: null, ok: false };

export async function cancelarTurno(
  token: string,
  _estadoPrevio: EstadoAccionToken,
): Promise<EstadoAccionToken> {
  const supabase = crearClientePublico();

  const { error } = await supabase
    .from("turnos")
    .update({ estado: "cancelado" })
    .eq("token_acceso", token)
    .eq("estado", "confirmado"); // no "cancela" algo ya cancelado/completado

  if (error) return { ...estadoInicial, error: error.message };
  return { error: null, ok: true };
}

export async function reprogramarTurno(
  token: string,
  dia: string,
  hora: string,
  _estadoPrevio: EstadoAccionToken,
): Promise<EstadoAccionToken> {
  const supabase = crearClientePublico();

  const { data: turno } = await supabase
    .from("turnos")
    .select("id")
    .eq("token_acceso", token)
    .eq("estado", "confirmado")
    .maybeSingle();

  if (!turno) return { ...estadoInicial, error: "No se encontró el turno." };

  const inicio = fechaMontevideo(dia, hora);

  const { error } = await supabase
    .from("turnos")
    .update({ inicio: inicio.toISOString() })
    .eq("id", turno.id);

  if (error) {
    // Mismo constraint anti-solapamiento que al reservar por primera vez.
    if (error.code === "23P01") {
      return { ...estadoInicial, error: "Uy, justo se ocupó ese horario. Elegí otro." };
    }
    return { ...estadoInicial, error: error.message };
  }

  return { error: null, ok: true };
}