"use server";

import { crearClienteServidor } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type EstadoAccion = { error: string | null };

// El negocio solo puede pasar un turno CONFIRMADO a cancelado o completado
// ("atendido"). Nunca al revés: reabrir un turno cancelado podría pisar
// otro turno que ya se reservó en ese horario.
const ESTADOS_PERMITIDOS = ["cancelado", "completado"] as const;
type NuevoEstado = (typeof ESTADOS_PERMITIDOS)[number];

export async function cambiarEstadoTurno(
  turnoId: string,
  nuevoEstado: NuevoEstado,
  _estadoPrevio: EstadoAccion,
): Promise<EstadoAccion> {
  if (!ESTADOS_PERMITIDOS.includes(nuevoEstado)) {
    return { error: "Estado inválido." };
  }

  const supabase = await crearClienteServidor();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: negocio } = await supabase.from("negocios").select("id").single();
  if (!negocio) return { error: "No se encontró el negocio de esta cuenta." };

  // RLS ("negocio ve y administra sus turnos") ya limita a este negocio; el
  // filtro explícito es una segunda barrera. `.select()` permite saber si
  // de verdad se actualizó algo (RLS no da error, solo actualiza 0 filas).
  const { data, error } = await supabase
    .from("turnos")
    .update({ estado: nuevoEstado })
    .eq("id", turnoId)
    .eq("negocio_id", negocio.id)
    .eq("estado", "confirmado")
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Ese turno ya no está confirmado (puede que lo haya cancelado el cliente)." };
  }

  revalidatePath("/dashboard/turnos");
  return { error: null };
}
