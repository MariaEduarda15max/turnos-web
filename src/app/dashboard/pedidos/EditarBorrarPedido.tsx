"use client";

import { useActionState, useState } from "react";
import { borrarPedido, editarPedido, type EstadoAccion } from "./actions";

const estadoInicial: EstadoAccion = { error: null };

// "Editar" abre un campo para cambiar la descripción; "Borrar" pide
// confirmación porque no se puede deshacer.
export default function EditarBorrarPedido({
  pedidoId,
  descripcion,
  monto,
}: {
  pedidoId: string;
  descripcion: string;
  monto: number | string | null;
}) {
  const [modo, setModo] = useState<"normal" | "editando" | "borrando">("normal");

  // Se envuelve la Server Action para cerrar el editor solo si guardó bien
  // (si falla, queda abierto mostrando el error). Esto corre al enviar el
  // formulario, no durante el render.
  const [estadoEditar, editar, guardando] = useActionState(
    async (previo: EstadoAccion, formData: FormData) => {
      const resultado = await editarPedido(pedidoId, previo, formData);
      if (!resultado.error) setModo("normal");
      return resultado;
    },
    estadoInicial,
  );
  const [estadoBorrar, borrar, borrando] = useActionState(
    borrarPedido.bind(null, pedidoId),
    estadoInicial,
  );

  if (modo === "editando") {
    return (
      <form action={editar} className="mt-2 flex flex-wrap items-center gap-2">
        <input
          name="descripcion"
          defaultValue={descripcion}
          required
          autoFocus
          className="flex-1 min-w-48 rounded-md border border-bosque-100 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque-400"
        />
        <input
          name="monto"
          inputMode="decimal"
          placeholder="Precio $"
          defaultValue={monto === null ? "" : String(monto)}
          className="w-24 rounded-md border border-bosque-100 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque-400"
        />
        <button
          type="submit"
          disabled={guardando}
          className="text-xs rounded-md bg-bosque-800 text-white px-2 py-1 disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={() => setModo("normal")} className="text-xs text-bosque-500">
          Cancelar
        </button>
        {estadoEditar.error && <span className="text-xs text-arcilla-600 w-full">{estadoEditar.error}</span>}
      </form>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-3">
      {modo === "borrando" ? (
        <form action={borrar} className="flex items-center gap-2">
          <span className="text-xs text-bosque-600">¿Borrar este pedido?</span>
          <button
            type="submit"
            disabled={borrando}
            className="text-xs rounded-md bg-arcilla-600 text-white px-2 py-1 disabled:opacity-60"
          >
            {borrando ? "Borrando…" : "Sí, borrar"}
          </button>
          <button type="button" onClick={() => setModo("normal")} className="text-xs text-bosque-500">
            No
          </button>
        </form>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setModo("editando")}
            className="text-xs text-bosque-500 hover:text-arcilla-600"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => setModo("borrando")}
            className="text-xs text-bosque-500 hover:text-arcilla-600"
          >
            Borrar
          </button>
        </>
      )}
      {estadoBorrar.error && <span className="text-xs text-arcilla-600">{estadoBorrar.error}</span>}
    </div>
  );
}
