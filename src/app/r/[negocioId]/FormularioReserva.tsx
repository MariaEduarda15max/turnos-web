"use client";

import { useActionState, useState } from "react";
import { reservarTurno, type EstadoReserva } from "./actions";

const estadoInicial: EstadoReserva = { error: null, tokenAcceso: null };

export default function FormularioReserva({
  negocioId,
  servicioId,
  dia,
  horarios,
}: {
  negocioId: string;
  servicioId: string;
  dia: string;
  horarios: string[];
}) {
  const [estado, accion, cargando] = useActionState(reservarTurno, estadoInicial);
  const [horaElegida, setHoraElegida] = useState<string | null>(null);

  // Si la reserva se confirmó, mostramos el link de "mi turno" en vez del
  // formulario — ese token_acceso es lo que le permite a alguien sin
  // cuenta volver a ver/cancelar/reprogramar ESTE turno puntual.
  if (estado.tokenAcceso) {
    return (
      <div className="rounded-lg border border-bosque-100 bg-white p-5 space-y-3">
        <p className="text-bosque-800">✅ Turno confirmado.</p>
        <p className="text-bosque-600 text-sm">
          Guardá este link para ver, cancelar o reprogramar tu turno:
        </p>
        <a
          href={`/r/${negocioId}/turno/${estado.tokenAcceso}`}
          className="block rounded-md bg-bosque-50 px-3 py-2 text-sm text-bosque-700 break-all"
        >
          {typeof window !== "undefined" ? window.location.origin : ""}
          /r/{negocioId}/turno/{estado.tokenAcceso}
        </a>
      </div>
    );
  }

  if (horarios.length === 0) {
    return <p className="text-bosque-500 text-sm">No quedan horarios libres ese día.</p>;
  }

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="negocioId" value={negocioId} />
      <input type="hidden" name="servicioId" value={servicioId} />
      <input type="hidden" name="dia" value={dia} />
      <input type="hidden" name="hora" value={horaElegida ?? ""} />

      <div className="grid grid-cols-3 gap-2">
        {horarios.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHoraElegida(h)}
            className={`rounded-md border px-2 py-2 text-sm transition-colors ${
              horaElegida === h
                ? "border-bosque-800 bg-bosque-800 text-white"
                : "border-bosque-100 bg-white text-bosque-700 hover:border-bosque-400"
            }`}
          >
            {h}
          </button>
        ))}
      </div>

      {horaElegida && (
        <div className="rounded-lg border border-bosque-100 bg-white p-4 space-y-3">
          <input
            name="nombre"
            type="text"
            placeholder="Tu nombre"
            required
            className="w-full rounded-md border border-bosque-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque-400"
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            className="w-full rounded-md border border-bosque-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque-400"
          />
          <input
            name="telefono"
            type="tel"
            placeholder="Teléfono (si no dejás email)"
            className="w-full rounded-md border border-bosque-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque-400"
          />
          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-md bg-bosque-800 text-white py-2 text-sm font-medium hover:bg-bosque-900 transition-colors disabled:opacity-60"
          >
            {cargando ? "Confirmando…" : `Confirmar ${horaElegida}`}
          </button>
        </div>
      )}

      {estado.error && <p className="text-arcilla-600 text-sm">{estado.error}</p>}
    </form>
  );
}