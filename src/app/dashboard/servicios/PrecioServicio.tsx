"use client";

import { useActionState, useState } from "react";
import { actualizarPrecio, type EstadoAccion } from "./actions";
import { formatearMonto } from "@/lib/dinero";

const estadoInicial: EstadoAccion = { error: null };

// Muestra el precio del servicio y permite cambiarlo en el lugar.
export default function PrecioServicio({
  servicioId,
  precio,
}: {
  servicioId: string;
  precio: number | string | null;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, guardar, guardando] = useActionState(
    async (previo: EstadoAccion, formData: FormData) => {
      const r = await actualizarPrecio(servicioId, previo, formData);
      if (!r.error) setEditando(false);
      return r;
    },
    estadoInicial,
  );

  if (editando) {
    return (
      <form action={guardar} className="flex items-center gap-2 text-sm">
        <input
          name="precio"
          inputMode="decimal"
          autoFocus
          placeholder="Sin precio"
          defaultValue={precio === null ? "" : String(precio)}
          className="w-24 rounded-md border border-bosque-100 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-bosque-400"
        />
        <button
          type="submit"
          disabled={guardando}
          className="text-xs rounded-md bg-bosque-800 text-white px-2 py-1 disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={() => setEditando(false)} className="text-xs text-bosque-500">
          Cancelar
        </button>
        {estado.error && <span className="text-xs text-arcilla-600">{estado.error}</span>}
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      className="text-sm text-bosque-500 hover:text-arcilla-600"
      title="Cambiar precio"
    >
      {precio === null ? "Agregar precio" : formatearMonto(precio)}
    </button>
  );
}
