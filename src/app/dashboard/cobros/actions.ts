"use server";

import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClientePublico } from "@/lib/supabase/publico";
import { leerMonto } from "@/lib/dinero";
import { revalidatePath } from "next/cache";

export type EstadoCobro = { error: string | null; guardado: boolean };

// Cómo cobra el negocio al reservar: nada, seña (% o monto fijo) o total.
export async function actualizarCobro(
  _estadoPrevio: EstadoCobro,
  formData: FormData,
): Promise<EstadoCobro> {
  const modo = String(formData.get("cobro_modo") ?? "");
  if (!["no_cobrar", "sena", "total"].includes(modo)) {
    return { error: "Elegí una opción de cobro.", guardado: false };
  }

  let senaTipo: string | null = null;
  let senaValor: number | null = null;
  if (modo === "sena") {
    senaTipo = String(formData.get("sena_tipo") ?? "");
    if (!["porcentaje", "monto"].includes(senaTipo)) {
      return { error: "Elegí si la seña es un porcentaje o un monto fijo.", guardado: false };
    }
    senaValor = leerMonto(formData.get("sena_valor"));
    if (senaValor === null || Number.isNaN(senaValor) || senaValor <= 0) {
      return { error: "Poné un valor de seña mayor a 0.", guardado: false };
    }
    if (senaTipo === "porcentaje" && senaValor > 100) {
      return { error: "El porcentaje no puede pasar de 100.", guardado: false };
    }
  }

  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado.", guardado: false };

  // RLS limita el update a la fila de este negocio; el check
  // negocios_sena_completa (0011) es la última barrera.
  const { data, error } = await supabase
    .from("negocios")
    .update({ cobro_modo: modo, sena_tipo: senaTipo, sena_valor: senaValor })
    .eq("auth_user_id", user.id)
    .select("id");

  if (error) return { error: error.message, guardado: false };
  if (!data || data.length === 0) return { error: "No se encontró el negocio.", guardado: false };

  revalidatePath("/dashboard/cobros");
  return { error: null, guardado: true };
}

// Borra los tokens guardados. mp_cuentas no tiene políticas de RLS, así
// que se borra con la key secreta, pero SOLO la fila del negocio de esta
// sesión (que se obtiene con RLS, nunca del formulario).
// No revoca el permiso del lado de MP: eso lo hace el negocio desde su
// cuenta de Mercado Pago (Seguridad → aplicaciones conectadas).
export async function desconectarMercadoPago(): Promise<void> {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: negocio } = await supabase.from("negocios").select("id").maybeSingle();
  if (!negocio) return;

  await crearClientePublico().from("mp_cuentas").delete().eq("negocio_id", negocio.id);
  revalidatePath("/dashboard/cobros");
}
