"use client";

import { useActionState } from "react";
import { crearServicio, type EstadoAccion } from "./actions";

const estadoInicial: EstadoAccion = { error: null };

export default function FormularioAgregarServicio() {
  // useActionState conecta el formulario con lo que devuelve la Server
  // Action, sin que un error tire abajo toda la página — la acción ya no
  // hace throw, devuelve { error } como dato normal (ver actions.ts).
  const [estado, accion, cargando] = useActionState(crearServicio, estadoInicial);

  return (
    <form action={accion} className="rounded-lg border border-bosque-100 bg-white p-5 mb-8 space-y-3">
      <h2 className="text-bosque-700 font-medium text-sm">Agregar servicio</h2>
      <div className="flex gap-3">
        <input
          name="nombre"
          type="text"
          placeholder="Nombre (ej. Corte)"
          required
          className="flex-1 rounded-md border border-bosque-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque-400"
        />
        <input
          name="duracion_min"
          type="number"
          placeholder="Minutos"
          required
          min={1}
          className="w-28 rounded-md border border-bosque-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque-400"
        />
        <button
          type="submit"
          disabled={cargando}
          className="rounded-md bg-bosque-800 text-white px-4 py-2 text-sm font-medium hover:bg-bosque-900 transition-colors disabled:opacity-60"
        >
          {cargando ? "Agregando…" : "Agregar"}
        </button>
      </div>
      {estado.error && <p className="text-arcilla-600 text-sm">{estado.error}</p>}
    </form>
  );
}