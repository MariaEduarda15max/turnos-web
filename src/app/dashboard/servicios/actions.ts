"use server";

import { crearClienteServidor } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type EstadoAccion = { error: string | null };

// Una Server Action: se ejecuta en el servidor, pero un formulario la
// puede llamar directo (ver page.tsx) sin necesitar una API Route aparte.
// No hace falta pasarle negocio_id a mano — la política de RLS
// "negocio administra sus servicios" exige negocio_id = negocio_actual(),
// así que si lo mandáramos mal, Postgres directamente rechazaría el insert.
//
// Devuelve { error } en vez de hacer throw: con useActionState, un throw
// tira abajo toda la página (pantalla de "crash"); devolver el error como
// dato normal permite mostrarlo prolijo dentro del propio formulario.
export async function crearServicio(
  _estadoPrevio: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const supabase = await crearClienteServidor();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: negocio } = await supabase
    .from("negocios")
    .select("id")
    .single();
  if (!negocio) return { error: "No se encontró el negocio." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const duracion_min = Number(formData.get("duracion_min"));

  if (!nombre || !duracion_min || duracion_min <= 0) {
    return { error: "Nombre y duración son obligatorios." };
  }

  const { error } = await supabase.from("servicios").insert({
    negocio_id: negocio.id,
    nombre,
    duracion_min,
  });

  if (error) return { error: error.message };

  // revalidatePath le dice a Next "la próxima vez que se pida esta
  // página, no uses la versión en caché" — sin esto, el servicio nuevo
  // no aparecería en la lista hasta un refresh manual.
  revalidatePath("/dashboard/servicios");
  return { error: null };
}

export async function alternarActivo(servicioId: string, activo: boolean) {
  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from("servicios")
    .update({ activo: !activo })
    .eq("id", servicioId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/servicios");
}

export async function borrarServicio(
  servicioId: string,
  _estadoPrevio: EstadoAccion,
): Promise<EstadoAccion> {
  const supabase = await crearClienteServidor();

  // Si el servicio ya tiene turnos asociados, la foreign key
  // "servicio_id references servicios(id)" (sin on delete cascade en
  // turnos.servicio_id) rechaza el borrado — a propósito: no queremos
  // perder el historial de turnos reales por accidente. En ese caso, lo
  // correcto es desactivarlo (alternarActivo), no borrarlo.
  const { error } = await supabase.from("servicios").delete().eq("id", servicioId);

  if (error) {
    if (error.code === "23503") {
      return {
        error: "Este servicio ya tiene turnos asociados — desactivalo en vez de borrarlo.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/servicios");
  return { error: null };
}