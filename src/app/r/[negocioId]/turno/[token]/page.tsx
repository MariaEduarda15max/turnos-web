import { crearClientePublico } from "@/lib/supabase/publico";
import { diaMontevideo, formatearFecha, horaMontevideo } from "@/lib/fechas";
import { diasConDisponibilidad } from "@/lib/slots";
import { calcularHorariosLibres } from "@/lib/slots";
import { notFound } from "next/navigation";
import Link from "next/link";
import BotonCancelar from "./BotonCancelar";
import FormularioReprogramar from "./FormularioReprogramar";

type Props = {
  params: Promise<{ negocioId: string; token: string }>;
  // status: lo agrega Mercado Pago al volver del checkout (back_urls).
  searchParams: Promise<{ dia?: string; status?: string; collection_status?: string }>;
};

const TEXTO_ESTADO: Record<string, string> = {
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  completado: "Atendido",
  ausente: "No asistió",
  pendiente_pago: "Esperando el pago",
};

export default async function TurnoPage({ params, searchParams }: Props) {
  const { negocioId, token } = await params;
  const { dia, status, collection_status } = await searchParams;
  const estadoVueltaMp = status ?? collection_status;

  const supabase = crearClientePublico();

  const { data: turno } = await supabase
    .from("turnos")
    .select("id, inicio, estado, expira_en, link_pago, servicio_id, servicios(nombre, duracion_min)")
    .eq("token_acceso", token)
    .eq("negocio_id", negocioId) // el token tiene que pertenecer a ESTE negocio
    .maybeSingle();

  if (!turno) notFound();

  const servicio = turno.servicios as unknown as { nombre: string; duracion_min: number };
  const esFuturo = new Date(turno.inicio).getTime() > Date.now();
  const puedeGestionar = turno.estado === "confirmado" && esFuturo;
  const retencionVigente =
    turno.estado === "pendiente_pago" && !!turno.expira_en && new Date(turno.expira_en).getTime() > Date.now();
  // Venció sin pagar: o ya lo liberó la limpieza (cancelado + expira_en),
  // o todavía figura pendiente pero pasó la hora.
  const retencionVencida =
    (turno.estado === "pendiente_pago" && !retencionVigente) ||
    (turno.estado === "cancelado" && !!turno.expira_en);

  return (
    <main className="min-h-screen px-6 py-10 max-w-md mx-auto">
      <h1 className="font-display text-2xl text-bosque-800 mb-8">Tu turno</h1>

      <div className="rounded-lg border border-bosque-100 bg-white p-5 space-y-2 mb-6">
        <p className="text-bosque-800">{servicio.nombre}</p>
        {/* Día y hora en Montevideo: inicio.slice(0, 10) tomaba la fecha
            en UTC, y un turno de las 21:00 o más tarde aparecía al día
            siguiente. */}
        <p className="text-bosque-600 text-sm">
          {formatearFecha(diaMontevideo(new Date(turno.inicio)))} a las{" "}
          {horaMontevideo(new Date(turno.inicio))}
        </p>
        <p className="text-bosque-500 text-sm">
          Estado: {retencionVencida ? "Reserva vencida" : (TEXTO_ESTADO[turno.estado] ?? turno.estado)}
        </p>
      </div>

      {/* Volvió de MP con el pago aprobado pero el aviso (webhook) todavía
          no llegó: el turno sigue "esperando el pago" unos segundos. */}
      {retencionVigente && estadoVueltaMp === "approved" && (
        <p className="rounded-md bg-bosque-50 px-3 py-2 text-sm text-bosque-700 mb-4">
          Recibimos tu pago y lo estamos confirmando. Recargá la página en unos segundos.
        </p>
      )}

      {retencionVigente && estadoVueltaMp !== "approved" && (
        <div className="rounded-lg border border-bosque-100 bg-white p-5 space-y-3 mb-4">
          <p className="text-bosque-700 text-sm">
            {estadoVueltaMp === "pending" || estadoVueltaMp === "in_process"
              ? "Tu pago está en proceso. Te confirmamos el turno apenas Mercado Pago lo apruebe."
              : `Para confirmar el turno falta el pago. Lo guardamos hasta las ${horaMontevideo(new Date(turno.expira_en!))}.`}
          </p>
          {turno.link_pago && estadoVueltaMp !== "pending" && estadoVueltaMp !== "in_process" && (
            <a
              href={turno.link_pago}
              className="inline-block rounded-md bg-bosque-800 text-white px-4 py-2 text-sm font-medium hover:bg-bosque-900 transition-colors"
            >
              Pagar con Mercado Pago
            </a>
          )}
        </div>
      )}

      {retencionVencida && (
        <p className="text-bosque-500 text-sm mb-4">
          La reserva venció porque no se completó el pago a tiempo. Si pagaste igual, el negocio lo
          va a ver y te contacta; si no, podés{" "}
          <Link href={`/r/${negocioId}`} className="text-arcilla-600 hover:underline">
            reservar de nuevo
          </Link>
          .
        </p>
      )}

      {!puedeGestionar && turno.estado === "confirmado" && (
        <p className="text-bosque-500 text-sm">Este turno ya pasó.</p>
      )}

      {puedeGestionar && !dia && (
        <div className="flex gap-3">
          <BotonCancelar token={token} />
          <Link
            href={`/r/${negocioId}/turno/${token}?dia=`}
            className="rounded-md border border-bosque-100 bg-white px-4 py-2 text-sm text-bosque-700 hover:border-bosque-400 transition-colors"
          >
            Reprogramar
          </Link>
        </div>
      )}

      {puedeGestionar && dia === "" && (
        <ListaDias negocioId={negocioId} token={token} />
      )}

      {puedeGestionar && dia && (
        <ReprogramarConHorarios
          negocioId={negocioId}
          servicioId={turno.servicio_id}
          turnoId={turno.id}
          token={token}
          dia={dia}
        />
      )}
    </main>
  );
}

async function ListaDias({ negocioId, token }: { negocioId: string; token: string }) {
  const supabase = crearClientePublico();
  const dias = await diasConDisponibilidad(supabase, negocioId);

  return (
    <div>
      <p className="text-bosque-600 text-sm mb-3">Elegí el nuevo día:</p>
      <ul className="space-y-2">
        {dias.map((d) => (
          <li key={d}>
            <Link
              href={`/r/${negocioId}/turno/${token}?dia=${d}`}
              className="block rounded-lg border border-bosque-100 bg-white px-4 py-3 hover:border-bosque-400 transition-colors"
            >
              {formatearFecha(d)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function ReprogramarConHorarios({
  negocioId,
  servicioId,
  turnoId,
  token,
  dia,
}: {
  negocioId: string;
  servicioId: string;
  turnoId: string;
  token: string;
  dia: string;
}) {
  const supabase = crearClientePublico();
  // Se excluye el turno propio: si no, se bloquearía a sí mismo como
  // "ocupado" en su propio horario actual.
  const horarios = await calcularHorariosLibres(supabase, negocioId, servicioId, dia, turnoId);

  return (
    <div>
      <p className="text-bosque-600 text-sm mb-3">{formatearFecha(dia)}</p>
      <FormularioReprogramar token={token} dia={dia} horarios={horarios} />
    </div>
  );
}