"use client";

import { useActionState } from "react";
import { crearFranja, type EstadoAccion } from "./actions";

const estadoInicial: EstadoAccion = { error: null };

const input =
  "rounded-md border border-bosque-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque-400";

// Mismo patrón que FormularioAgregarServicio: la acción devuelve { error }
// en vez de hacer throw, y el error se muestra acá adentro.
export default function FormularioFranja({
  dias,
}: {
  dias: { valor: number; nombre: string }[];
}) {
  const [estado, accion, cargando] = useActionState(crearFranja, estadoInicial);

  return (
    <form action={accion} className="rounded-lg border border-bosque-100 bg-white p-5 mb-4 space-y-3">
      <h3 className="text-bosque-700 font-medium text-sm">Agregar franja</h3>
      <div className="flex flex-wrap gap-3">
        <select name="dia_semana" required className={`${input} flex-1 min-w-32`}>
          {dias.map((d) => (
            <option key={d.valor} value={d.valor}>{d.nombre}</option>
          ))}
        </select>
        <input name="hora_desde" type="time" required aria-label="Desde" className={input} />
        <input name="hora_hasta" type="time" required aria-label="Hasta" className={input} />
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
