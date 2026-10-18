"use client";

import { useActionState } from "react";
import { crearPedido, type EstadoAccion } from "./actions";

const estadoInicial: EstadoAccion = { error: null };

const input =
  "rounded-md border border-bosque-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque-400";

export default function FormularioPedido() {
  const [estado, accion, cargando] = useActionState(crearPedido, estadoInicial);

  return (
    <form action={accion} className="rounded-lg border border-bosque-100 bg-white p-5 mb-8 space-y-3">
      <h2 className="text-bosque-800 font-medium text-sm">Nuevo pedido</h2>
      <input
        name="descripcion"
        type="text"
        required
        placeholder="Qué es (ej. Pantalón con ruedo)"
        className={`${input} w-full`}
      />
      <input
        name="monto"
        inputMode="decimal"
        placeholder="Precio en $ (opcional)"
        className={`${input} w-48`}
      />
      <div className="flex flex-wrap gap-3">
        <input name="nombre" type="text" required placeholder="Nombre del cliente" className={`${input} flex-1 min-w-40`} />
        <input name="email" type="email" placeholder="Email" className={`${input} flex-1 min-w-40`} />
        <input name="telefono" type="tel" placeholder="Teléfono" className={`${input} w-36`} />
      </div>
      <p className="text-bosque-400 text-xs">
        Si el email ya es de un cliente con cuenta, va a ver el pedido en su sección "Mis turnos".
      </p>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={cargando}
          className="rounded-md bg-bosque-800 text-white px-4 py-2 text-sm font-medium hover:bg-bosque-900 transition-colors disabled:opacity-60"
        >
          {cargando ? "Guardando…" : "Agregar pedido"}
        </button>
        {estado.error && <p className="text-arcilla-600 text-sm">{estado.error}</p>}
      </div>
    </form>
  );
}
