"use client";

import { useActionState, useState } from "react";
import { cambiarEstadoTurno, type EstadoAccion } from "./actions";

const estadoInicial: EstadoAccion = { error: null };

// Botones de un turno confirmado. Cancelar pide confirmación (no se puede
// deshacer); "Atendido" y "No vino" solo aparecen si el turno ya empezó.
export default function AccionesTurno({
  turnoId,
  yaEmpezo,
}: {
  turnoId: string;
  yaEmpezo: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);

  const [estadoCancelar, cancelar, cancelando] = useActionState(
    cambiarEstadoTurno.bind(null, turnoId, "cancelado"),
    estadoInicial,
  );
  const [estadoAtendido, marcarAtendido, marcando] = useActionState(
    cambiarEstadoTurno.bind(null, turnoId, "completado"),
    estadoInicial,
  );
  const [estadoAusente, marcarAusente, marcandoAusente] = useActionState(
    cambiarEstadoTurno.bind(null, turnoId, "ausente"),
    estadoInicial,
  );

  const error = estadoCancelar.error ?? estadoAtendido.error ?? estadoAusente.error;
  const ocupado = cancelando || marcando || marcandoAusente;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {yaEmpezo && !confirmando && (
          <form action={marcarAtendido}>
            <button
              type="submit"
              disabled={ocupado}
              className="text-xs rounded-md border border-bosque-100 px-2 py-1 text-bosque-600 hover:border-bosque-400 disabled:opacity-60"
            >
              {marcando ? "Guardando…" : "Atendido"}
            </button>
          </form>
        )}

        {yaEmpezo && !confirmando && (
          <form action={marcarAusente}>
            <button
              type="submit"
              disabled={ocupado}
              className="text-xs rounded-md border border-bosque-100 px-2 py-1 text-bosque-600 hover:border-arcilla-400 disabled:opacity-60"
            >
              {marcandoAusente ? "Guardando…" : "No vino"}
            </button>
          </form>
        )}

        {!confirmando ? (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={ocupado}
            className="text-xs text-bosque-400 hover:text-arcilla-600 px-1 disabled:opacity-60"
          >
            Cancelar
          </button>
        ) : (
          <form action={cancelar} className="flex items-center gap-2">
            <span className="text-xs text-bosque-600">¿Cancelar este turno?</span>
            <button
              type="submit"
              disabled={ocupado}
              className="text-xs rounded-md bg-arcilla-600 text-white px-2 py-1 disabled:opacity-60"
            >
              {cancelando ? "Cancelando…" : "Sí, cancelar"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="text-xs text-bosque-500 hover:text-bosque-800"
            >
              No
            </button>
          </form>
        )}
      </div>
      {error && <p className="text-xs text-arcilla-600">{error}</p>}
    </div>
  );
}
