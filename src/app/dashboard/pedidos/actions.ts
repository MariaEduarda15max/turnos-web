"use server";

import { crearClienteServidor } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { leerMonto } from "@/lib/dinero";

export type EstadoAccion = { error: string | null };

const RUTA = "/dashboard/pedidos";

async function obtenerNegocio() {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, negocioId: null };
  const { data: negocio } = await supabase.from("negocios").select("id").single();
  return { supabase, negocioId: (negocio?.id as string | undefined) ?? null };
}

// Crea un pedido para un cliente identificado por email (o teléfono).
// Si ya existe un cliente con ese email en este negocio se reusa —
// prefiriendo el que tiene cuenta, así el pedido le aparece en "Mis
// turnos"—; si no, se crea uno nuevo como invitado.
export async function crearPedido(
  _estadoPrevio: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const { supabase, negocioId } = await obtenerNegocio();
  if (!negocioId) return { error: "No se encontró el negocio de esta cuenta." };

  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const telefono = String(formData.get("telefono") ?? "").trim();

  if (!descripcion) return { error: "Escribí qué es el pedido." };
  const monto = leerMonto(formData.get("monto"));
  if (Number.isNaN(monto) || (monto !== null && monto < 0)) {
    return { error: "El precio no es un número válido." };
  }
  if (!nombre || (!email && !telefono)) {
    return { error: "Nombre y (email o teléfono) del cliente son obligatorios." };
  }

  let clienteId: string | null = null;

  if (email) {
    const { data: existentes } = await supabase
      .from("clientes")
      .select("id")
      .eq("negocio_id", negocioId)
      .eq("email", email)
      .order("auth_user_id", { ascending: true, nullsFirst: false })
      .limit(1);
    if (existentes && existentes.length > 0) clienteId = existentes[0].id as string;
  }

  if (!clienteId) {
    const { data: nuevo, error } = await supabase
      .from("clientes")
      .insert({ negocio_id: negocioId, nombre, email: email || null, telefono: telefono || null })
      .select("id")
      .single();
    if (error || !nuevo) return { error: "No se pudo registrar el cliente." };
    clienteId = nuevo.id as string;
  }

  const { error } = await supabase.from("pedidos").insert({
    negocio_id: negocioId,
    cliente_id: clienteId,
    descripcion,
    monto,
  });
  if (error) return { error: error.message };

  revalidatePath(RUTA);
  return { error: null };
}

// Solo hacia adelante: pendiente → listo → entregado. Se filtra por el
// estado de origen para que dos clics (o dos pestañas) no salten pasos.
const TRANSICIONES = {
  listo: { desde: "pendiente", columna: "listo_en" },
  entregado: { desde: "listo", columna: "entregado_en" },
} as const;

export async function avanzarPedido(
  pedidoId: string,
  nuevoEstado: keyof typeof TRANSICIONES,
  _estadoPrevio: EstadoAccion,
): Promise<EstadoAccion> {
  const transicion = TRANSICIONES[nuevoEstado];
  if (!transicion) return { error: "Estado inválido." };

  const { supabase, negocioId } = await obtenerNegocio();
  if (!negocioId) return { error: "No se encontró el negocio de esta cuenta." };

  const { data, error } = await supabase
    .from("pedidos")
    .update({ estado: nuevoEstado, [transicion.columna]: new Date().toISOString() })
    .eq("id", pedidoId)
    .eq("negocio_id", negocioId)
    .eq("estado", transicion.desde)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "El pedido ya cambió de estado." };

  revalidatePath(RUTA);
  return { error: null };
}

// Cambia solo la descripción. El cliente no se edita acá: si el pedido es
// de otra persona, se borra y se carga de nuevo.
export async function editarPedido(
  pedidoId: string,
  _estadoPrevio: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  if (!descripcion) return { error: "La descripción no puede quedar vacía." };
  const monto = leerMonto(formData.get("monto"));
  if (Number.isNaN(monto) || (monto !== null && monto < 0)) {
    return { error: "El precio no es un número válido." };
  }

  const { supabase, negocioId } = await obtenerNegocio();
  if (!negocioId) return { error: "No se encontró el negocio de esta cuenta." };

  const { data, error } = await supabase
    .from("pedidos")
    .update({ descripcion, monto })
    .eq("id", pedidoId)
    .eq("negocio_id", negocioId)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "No se encontró el pedido." };

  revalidatePath(RUTA);
  return { error: null };
}

export async function borrarPedido(
  pedidoId: string,
  _estadoPrevio: EstadoAccion,
): Promise<EstadoAccion> {
  const { supabase, negocioId } = await obtenerNegocio();
  if (!negocioId) return { error: "No se encontró el negocio de esta cuenta." };

  const { data, error } = await supabase
    .from("pedidos")
    .delete()
    .eq("id", pedidoId)
    .eq("negocio_id", negocioId)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "No se encontró el pedido." };

  revalidatePath(RUTA);
  return { error: null };
}
