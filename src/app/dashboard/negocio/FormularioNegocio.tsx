"use client";

import { useActionState } from "react";
import { actualizarNegocio, type EstadoAccion } from "./actions";

const estadoInicial: EstadoAccion = { error: null, guardado: false };

const input =
  "w-full rounded-md border border-bosque-100 bg-white px-3 py-2 text-sm text-bosque-900 focus:outline-none focus:ring-2 focus:ring-bosque-400";

export default function FormularioNegocio({
  nombre,
  emailAdmin,
}: {
  nombre: string;
  emailAdmin: string;
}) {
  const [estado, accion, guardando] = useActionState(actualizarNegocio, estadoInicial);

  return (
    <form action={accion} className="rounded-lg border border-bosque-100 bg-white p-6 space-y-4">
      <div>
        <label htmlFor="nombre" className="block text-sm text-bosque-700 mb-1">
          Nombre del negocio
        </label>
        <input id="nombre" name="nombre" type="text" required maxLength={80} defaultValue={nombre} className={input} />
        <p className="text-bosque-400 text-xs mt-1">Es el título que ven tus clientes en la página de reservas.</p>
      </div>

      <div>
        <label htmlFor="email_admin" className="block text-sm text-bosque-700 mb-1">
          Email de contacto
        </label>
        <input id="email_admin" name="email_admin" type="email" required defaultValue={emailAdmin} className={input} />
        <p className="text-bosque-400 text-xs mt-1">
          Solo es un dato de contacto: no cambia el email con el que entrás al panel.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-bosque-800 text-white px-4 py-2 text-sm font-medium hover:bg-bosque-900 transition-colors disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        {estado.error && <p className="text-arcilla-600 text-sm">{estado.error}</p>}
        {!estado.error && estado.guardado && !guardando && (
          <p className="text-bosque-600 text-sm">Cambios guardados.</p>
        )}
      </div>
    </form>
  );
}
