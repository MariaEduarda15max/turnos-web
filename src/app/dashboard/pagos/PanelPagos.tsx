"use client";

import { useActionState, useState } from "react";
import { borrarPago, registrarPago, type EstadoAccion } from "./actions";
import { ETIQUETA_METODO, formatearMonto, resumirPagos, type PagoResumen } from "@/lib/dinero";

const estadoInicial: EstadoAccion = { error: null };

// Resumen de pagos de un turno o pedido + formulario para registrar uno.
export default function PanelPagos({
  tipo,
  destinoId,
  pagos,
  total,
}: {
  tipo: "turno" | "pedido";
  destinoId: string;
  pagos: PagoResumen[];
  total: number | string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const resumen = resumirPagos(pagos, total);

  const [estado, registrar, guardando] = useActionState(
    async (previo: EstadoAccion, formData: FormData) => {
      const r = await registrarPago(tipo, destinoId, previo, formData);
      if (!r.error) setAbierto(false);
      return r;
    },
    estadoInicial,
  );

  const pagadoCompleto = resumen.total !== null && resumen.falta === 0 && resumen.pagado > 0;

  return (
    <div className="mt-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        {pagadoCompleto ? (
          <span className="rounded-full bg-bosque-100 text-bosque-800 px-2 py-0.5">Pagado</span>
        ) : resumen.pagado > 0 ? (
          <span className="rounded-full border border-bosque-400 text-bosque-600 px-2 py-0.5">
            Pagó {formatearMonto(resumen.pagado)}
            {resumen.falta !== null && ` · falta ${formatearMonto(resumen.falta)}`}
          </span>
        ) : (
          <span className="text-bosque-400">
            Sin pagos{resumen.total !== null && ` · precio ${formatearMonto(resumen.total)}`}
          </span>
        )}
        {!abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="text-arcilla-600 hover:underline"
          >
            Registrar pago
          </button>
        )}
      </div>

      {pagos.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {pagos.map((p) => (
            <FilaPago key={p.id} pago={p} />
          ))}
        </ul>
      )}

      {abierto && (
        <form action={registrar} className="mt-2 flex flex-wrap items-center gap-2">
          <input
            name="monto"
            inputMode="decimal"
            required
            placeholder="Monto"
            defaultValue={resumen.falta && resumen.falta > 0 ? String(resumen.falta) : ""}
            className="w-24 rounded-md border border-bosque-100 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-bosque-400"
          />
          <select
            name="metodo"
            required
            defaultValue="efectivo"
            className="rounded-md border border-bosque-100 px-2 py-1"
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="mercadopago">Mercado Pago</option>
            <option value="otro">Otro</option>
          </select>
          <input
            name="nota"
            placeholder="Nota (opcional)"
            className="flex-1 min-w-32 rounded-md border border-bosque-100 px-2 py-1"
          />
          <button
            type="submit"
            disabled={guardando}
            className="rounded-md bg-bosque-800 text-white px-2 py-1 disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" onClick={() => setAbierto(false)} className="text-bosque-500">
            Cancelar
          </button>
          {estado.error && <span className="w-full text-arcilla-600">{estado.error}</span>}
        </form>
      )}
    </div>
  );
}

function FilaPago({ pago }: { pago: PagoResumen }) {
  const [confirmando, setConfirmando] = useState(false);
  const [estado, borrar, borrando] = useActionState(borrarPago.bind(null, pago.id), estadoInicial);
  const fecha = new Date(pago.creado_en).toLocaleDateString("es-UY", {
    day: "numeric",
    month: "short",
    timeZone: "America/Montevideo",
  });

  return (
    <li className="flex flex-wrap items-center gap-2 text-bosque-500">
      <span>
        {formatearMonto(pago.monto)} · {ETIQUETA_METODO[pago.metodo]} · {fecha}
        {pago.nota && ` · ${pago.nota}`}
      </span>
      {confirmando ? (
        <form action={borrar} className="flex items-center gap-1">
          <button type="submit" disabled={borrando} className="text-arcilla-600">
            {borrando ? "Borrando…" : "Sí, borrar"}
          </button>
          <button type="button" onClick={() => setConfirmando(false)} className="text-bosque-500">
            No
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="text-bosque-400 hover:text-arcilla-600"
          title="Borrar pago"
        >
          ✕
        </button>
      )}
      {estado.error && <span className="text-arcilla-600">{estado.error}</span>}
    </li>
  );
}
