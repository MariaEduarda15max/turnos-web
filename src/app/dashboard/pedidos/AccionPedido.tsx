"use client";

import { useActionState } from "react";
import { avanzarPedido, type EstadoAccion } from "./actions";

const estadoInicial: EstadoAccion = { error: null };

// Un solo botón por pedido: el siguiente paso de su estado.
export default function AccionPedido({
  pedidoId,
  siguiente,
}: {
  pedidoId: string;
  siguiente: "listo" | "entregado";
}) {
  const [estado, accion, cargando] = useActionState(
    avanzarPedido.bind(null, pedidoId, siguiente),
    estadoInicial,
  );

  return (
    <form action={accion} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={cargando}
        className="text-xs rounded-md border border-bosque-100 px-2 py-1 text-bosque-600 hover:border-bosque-400 disabled:opacity-60"
      >
        {cargando ? "Guardando…" : siguiente === "listo" ? "Marcar listo" : "Marcar entregado"}
      </button>
      {estado.error && <p className="text-xs text-arcilla-600">{estado.error}</p>}
    </form>
  );
}
