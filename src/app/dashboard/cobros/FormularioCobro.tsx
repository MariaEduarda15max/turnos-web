"use client";

import { useActionState, useState } from "react";
import { actualizarCobro, type EstadoCobro } from "./actions";

const estadoInicial: EstadoCobro = { error: null, guardado: false };

const input =
  "rounded-md border border-bosque-100 bg-white px-3 py-2 text-sm text-bosque-900 focus:outline-none focus:ring-2 focus:ring-bosque-400";

type Modo = "no_cobrar" | "sena" | "total";

export default function FormularioCobro({
  modo,
  senaTipo,
  senaValor,
}: {
  modo: Modo;
  senaTipo: "porcentaje" | "monto" | null;
  senaValor: number | string | null;
}) {
  const [estado, accion, guardando] = useActionState(actualizarCobro, estadoInicial);
  const [modoElegido, setModoElegido] = useState<Modo>(modo);

  const opcion = (valor: Modo, titulo: string, detalle: string) => (
    <label className="flex gap-3 items-start cursor-pointer">
      <input
        type="radio"
        name="cobro_modo"
        value={valor}
        checked={modoElegido === valor}
        onChange={() => setModoElegido(valor)}
        className="mt-1"
      />
      <span>
        <span className="block text-sm text-bosque-800">{titulo}</span>
        <span className="block text-xs text-bosque-500">{detalle}</span>
      </span>
    </label>
  );

  return (
    <form action={accion} className="rounded-lg border border-bosque-100 bg-white p-6 space-y-4">
      {opcion("no_cobrar", "No cobrar al reservar", "El turno se confirma al toque, como hasta ahora.")}
      {opcion("sena", "Cobrar una seña", "Un porcentaje del precio o un monto fijo.")}
      {opcion("total", "Cobrar el total", "El precio completo del servicio.")}

      {modoElegido === "sena" && (
        <div className="flex flex-wrap items-center gap-2 pl-7">
          <select name="sena_tipo" defaultValue={senaTipo ?? "porcentaje"} className={input}>
            <option value="porcentaje">Porcentaje (%)</option>
            <option value="monto">Monto fijo ($)</option>
          </select>
          <input
            name="sena_valor"
            inputMode="decimal"
            defaultValue={senaValor ?? ""}
            placeholder="Ej.: 30"
            className={`${input} w-28`}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-bosque-800 text-white px-4 py-2 text-sm font-medium hover:bg-bosque-900 transition-colors disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        {estado.error && <p className="text-arcilla-600 text-sm">{estado.error}</p>}
        {!estado.error && estado.guardado && !guardando && (
          <p className="text-bosque-600 text-sm">Guardado.</p>
        )}
      </div>
    </form>
  );
}
