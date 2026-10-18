"use server";

import { crearClienteServidor } from "@/lib/supabase/server";
import { leerMonto } from "@/lib/dinero";
import { revalidatePath } from "next/cache";

export type EstadoAccion = { error: string | null };

const METODOS = ["efectivo", "transferencia", "mercadopago", "otro"] as const;

function revalidar() {
  revalidatePath("/dashboard/turnos");
  revalidatePath("/dashboard/pedidos");
}

async function obtenerNegocioId() {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, negocioId: null as string | null };
  const { data: negocio } = await supabase.from("negocios").select("id").single();
  return { supabase, negocioId: (negocio?.id as string | undefined) ?? null };
}

// Registra un pago manual de un turno o de un pedido.
export async function registrarPago(
  tipo: "turno" | "pedido",
  destinoId: string,
  _estadoPrevio: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  if (tipo !== "turno" && tipo !== "pedido") return { error: "Destino inválido." };

  const monto = leerMonto(formData.get("monto"));
  if (monto === null || Number.isNaN(monto) || monto <= 0) {
    return { error: "Ingresá un monto mayor a 0." };
  }

  const metodo = String(formData.get("metodo") ?? "");
  if (!METODOS.includes(metodo as (typeof METODOS)[number])) {
    return { error: "Elegí cómo te pagaron." };
  }

  const nota = String(formData.get("nota") ?? "").trim() || null;

  const { supabase, negocioId } = await obtenerNegocioId();
  if (!negocioId) return { error: "No se encontró el negocio de esta cuenta." };

  // El trigger de la 0009 verifica además que el turno/pedido sea de
  // este negocio.
  const { error } = await supabase.from("pagos").insert({
    negocio_id: negocioId,
    turno_id: tipo === "turno" ? destinoId : null,
    pedido_id: tipo === "pedido" ? destinoId : null,
    monto,
    metodo,
    nota,
  });

  if (error) return { error: error.message };

  revalidar();
  return { error: null };
}

export async function borrarPago(
  pagoId: string,
  _estadoPrevio: EstadoAccion,
): Promise<EstadoAccion> {
  const { supabase, negocioId } = await obtenerNegocioId();
  if (!negocioId) return { error: "No se encontró el negocio de esta cuenta." };

  // Solo los pagos manuales se pueden borrar: uno online (etapa 2) es un
  // cobro real de Mercado Pago y se corrige con una devolución, no
  // borrándolo.
  const { data, error } = await supabase
    .from("pagos")
    .delete()
    .eq("id", pagoId)
    .eq("negocio_id", negocioId)
    .eq("origen", "manual")
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "No se encontró el pago." };

  revalidar();
  return { error: null };
}
