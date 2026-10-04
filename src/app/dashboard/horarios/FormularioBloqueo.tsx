"use client";

import { useActionState } from "react";
import { crearBloqueo, type EstadoAccion } from "./actions";

const estadoInicial: EstadoAccion = { error: null };

const input =
  "rounded-md border border-bosque-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque-400";

export default function FormularioBloqueo({ hoy }: { hoy: string }) {
  const [estado, accion, cargando] = useActionState(crearBloqueo, estadoInicial);

  return (
    <form action={accion} className="rounded-lg border border-bosque-100 bg-white p-5 mb-4 space-y-3">
      <h3 className="text-bosque-700 font-medium text-sm">Agregar bloqueo</h3>
      <div className="flex flex-wrap gap-3 items-center">
        <input name="fecha" type="date" required min={hoy} aria-label="Fecha" className={input} />
        <input name="hora_desde" type="time" aria-label="Desde" className={input} />
        <input name="hora_hasta" type="time" aria-label="Hasta" className={input} />
        <label className="flex items-center gap-2 text-sm text-bosque-700">
          <input name="todo_el_dia" type="checkbox" className="accent-bosque-800" />
          Todo el día
        </label>
      </div>
      <div className="flex gap-3">
        <input
          name="motivo"
          type="text"
          placeholder="Motivo (opcional)"
          className={`${input} flex-1`}
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
