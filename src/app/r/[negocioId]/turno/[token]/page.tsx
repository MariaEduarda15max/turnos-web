import { crearClientePublico } from "@/lib/supabase/publico";
import { formatearFecha } from "@/lib/fechas";
import { diasConDisponibilidad } from "@/lib/slots";
import { calcularHorariosLibres } from "@/lib/slots";
import { notFound } from "next/navigation";
import Link from "next/link";
import BotonCancelar from "./BotonCancelar";
import FormularioReprogramar from "./FormularioReprogramar";

type Props = {
  params: Promise<{ negocioId: string; token: string }>;
  searchParams: Promise<{ dia?: string }>;
};

export default async function TurnoPage({ params, searchParams }: Props) {
  const { negocioId, token } = await params;
  const { dia } = await searchParams;

  const supabase = crearClientePublico();

  const { data: turno } = await supabase
    .from("turnos")
    .select("id, inicio, estado, servicio_id, servicios(nombre, duracion_min)")
    .eq("token_acceso", token)
    .eq("negocio_id", negocioId) // el token tiene que pertenecer a ESTE negocio
    .maybeSingle();

  if (!turno) notFound();

  const servicio = turno.servicios as unknown as { nombre: string; duracion_min: number };
  const esFuturo = new Date(turno.inicio).getTime() > Date.now();
  const puedeGestionar = turno.estado === "confirmado" && esFuturo;

  return (
    <main className="min-h-screen px-6 py-10 max-w-md mx-auto">
      <h1 className="font-display text-2xl text-bosque-800 mb-8">Tu turno</h1>

      <div className="rounded-lg border border-bosque-100 bg-white p-5 space-y-2 mb-6">
        <p className="text-bosque-800">{servicio.nombre}</p>
        <p className="text-bosque-600 text-sm capitalize">
          {formatearFecha(turno.inicio.slice(0, 10))} a las{" "}
          {new Date(turno.inicio).toLocaleTimeString("es-UY", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Montevideo",
          })}
        </p>
        <p className="text-bosque-500 text-sm capitalize">Estado: {turno.estado}</p>
      </div>

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
              className="block rounded-lg border border-bosque-100 bg-white px-4 py-3 hover:border-bosque-400 transition-colors capitalize"
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
      <p className="text-bosque-600 text-sm mb-3 capitalize">{formatearFecha(dia)}</p>
      <FormularioReprogramar token={token} dia={dia} horarios={horarios} />
    </div>
  );
}