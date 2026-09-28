"use client";

import { useActionState } from "react";
import { borrarServicio, type EstadoAccion } from "./actions";

const estadoInicial: EstadoAccion = { error: null };

export default function BotonBorrarServicio({ servicioId }: { servicioId: string }) {
  // .bind fija el id del lado del cliente esta vez (no del servidor como en
  // alternarActivo) porque useActionState necesita que la acción tenga la
  // forma (estadoPrevio, formData) => estado — el bind deja solo esos dos
  // parámetros "libres" para que el hook los complete.
  const accionConId = borrarServicio.bind(null, servicioId);
  const [estado, accion, cargando] = useActionState(accionConId, estadoInicial);

  return (
    <form action={accion}>
      <button
        type="submit"
        disabled={cargando}
        className="text-sm text-bosque-400 hover:text-arcilla-600 px-2 disabled:opacity-60"
        title="Borrar"
      >
        ✕
      </button>
      {estado.error && (
        <p className="text-arcilla-600 text-xs mt-1 max-w-[160px] text-right">{estado.error}</p>
      )}
    </form>
  );
}