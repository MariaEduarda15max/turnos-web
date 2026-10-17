"use server";

import { crearClienteServidor } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type EstadoAccion = { error: string | null; guardado: boolean };

// Edita el nombre visible del negocio y su email de CONTACTO. No toca el
// email con el que se inicia sesión (eso es de Supabase Auth, otra cosa).
export async function actualizarNegocio(
  _estadoPrevio: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email_admin") ?? "").trim().toLowerCase();

  if (!nombre) return { error: "El nombre no puede quedar vacío.", guardado: false };
  if (nombre.length > 80) return { error: "El nombre es demasiado largo (máx. 80).", guardado: false };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "El email de contacto no es válido.", guardado: false };
  }

  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado.", guardado: false };

  // RLS ("negocio ve y edita su propio registro") limita el update a la
  // fila de este usuario; el filtro por auth_user_id es una segunda barrera.
  const { data, error } = await supabase
    .from("negocios")
    .update({ nombre, email_admin: email })
    .eq("auth_user_id", user.id)
    .select("id");

  if (error) return { error: error.message, guardado: false };
  if (!data || data.length === 0) {
    return { error: "No se encontró el negocio de esta cuenta.", guardado: false };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/negocio");
  return { error: null, guardado: true };
}
