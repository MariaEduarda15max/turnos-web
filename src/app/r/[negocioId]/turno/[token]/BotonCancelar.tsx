"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cancelarTurno, type EstadoAccionToken } from "./actions";

const estadoInicial: EstadoAccionToken = { error: null, ok: false };

export default function BotonCancelar({ token }: { token: string }) {
  const router = useRouter();
  const [pidiendoConfirmacion, setPidiendoConfirmacion] = useState(false);

  const accionConToken = cancelarTurno.bind(null, token);
  const [estado, accion, cargando] = useActionState(accionConToken, estadoInicial);

  useEffect(() => {
    if (estado.ok) router.refresh();
  }, [estado.ok, router]);

  // SPEC.md 1.3 de turnos-bot: pedir confirmación antes de cancelar, para
  // evitar que un toque accidental cancele un turno real.
  if (estado.ok) {
    return <p className="text-bosque-600 text-sm">Turno cancelado.</p>;
  }

  if (pidiendoConfirmacion) {
    return (
      <form action={accion} className="space-y-2">
        <p className="text-bosque-700 text-sm">¿Seguro que querés cancelar?</p>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={cargando}
            className="rounded-md bg-arcilla-500 text-white px-3 py-1 text-sm disabled:opacity-60"
          >
            Sí, cancelar
          </button>
          <button
            type="button"
            onClick={() => setPidiendoConfirmacion(false)}
            className="rounded-md border border-bosque-100 px-3 py-1 text-sm text-bosque-700"
          >
            No
          </button>
        </div>
        {estado.error && <p className="text-arcilla-600 text-xs">{estado.error}</p>}
      </form>
    );
  }

  return (
    <button
      onClick={() => setPidiendoConfirmacion(true)}
      className="rounded-md border border-bosque-100 bg-white px-4 py-2 text-sm text-bosque-700 hover:border-arcilla-400 transition-colors"
    >
      Cancelar
    </button>
  );
}