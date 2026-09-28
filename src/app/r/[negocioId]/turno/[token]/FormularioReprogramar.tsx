"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { reprogramarTurno, type EstadoAccionToken } from "./actions";

const estadoInicial: EstadoAccionToken = { error: null, ok: false };

export default function FormularioReprogramar({
  token,
  dia,
  horarios,
}: {
  token: string;
  dia: string;
  horarios: string[];
}) {
  const router = useRouter();
  const [horaElegida, setHoraElegida] = useState<string | null>(null);

  const accionConDatos = horaElegida
    ? reprogramarTurno.bind(null, token, dia, horaElegida)
    : reprogramarTurno.bind(null, token, dia, "");
  const [estado, accion, cargando] = useActionState(accionConDatos, estadoInicial);

  // Redirigir DENTRO de un efecto, no durante el render: llamar al router
  // mientras el componente se está renderizando es lo que generaba el 404
  // (con "." como ruta literal, que no existe) — acá se usa la ruta real
  // (sin el ?dia), y se dispara después de que React ya terminó de pintar.
  useEffect(() => {
    if (estado.ok) {
      router.replace(window.location.pathname);
      router.refresh();
    }
  }, [estado.ok, router]);

  if (estado.ok) {
    return <p className="text-bosque-600 text-sm">Turno reprogramado.</p>;
  }

  if (horarios.length === 0) {
    return <p className="text-bosque-500 text-sm">No quedan horarios libres ese día.</p>;
  }

  return (
    <form action={accion} className="space-y-4">
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
        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded-md bg-bosque-800 text-white py-2 text-sm font-medium hover:bg-bosque-900 transition-colors disabled:opacity-60"
        >
          {cargando ? "Confirmando…" : `Confirmar nuevo horario ${horaElegida}`}
        </button>
      )}

      {estado.error && <p className="text-arcilla-600 text-sm">{estado.error}</p>}
    </form>
  );
}