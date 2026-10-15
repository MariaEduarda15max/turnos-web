import { crearClienteServidor } from "@/lib/supabase/server";
import { diaMontevideo, formatearFecha, horaMontevideo } from "@/lib/fechas";
import { redirect } from "next/navigation";
import Link from "next/link";
import CerrarSesionBoton from "@/components/CerrarSesionBoton";

type TurnoCliente = {
  id: string;
  inicio: string;
  estado: "confirmado" | "cancelado" | "completado";
  token_acceso: string;
  // Puede venir null si RLS no deja leer el servicio (ver 0004): nunca
  // asumir que el join trae datos.
  servicios: { nombre: string } | null;
};

const nombreServicio = (t: TurnoCliente) => t.servicios?.nombre ?? "Servicio";

const cuando = (t: TurnoCliente) => {
  const inicio = new Date(t.inicio);
  return `${formatearFecha(diaMontevideo(inicio))} · ${horaMontevideo(inicio)}`;
};

// Un turno "confirmado" que ya pasó no se marcó como atendido: se muestra
// como "Pasado" en vez de un "Confirmado" que confunde.
const etiquetaHistorial = (estado: TurnoCliente["estado"]) =>
  estado === "cancelado" ? "Cancelado" : estado === "completado" ? "Atendido" : "Pasado";

export default async function MisTurnosPage({
  params,
}: {
  params: Promise<{ negocioId: string }>;
}) {
  const { negocioId } = await params;
  const supabase = await crearClienteServidor();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/r/${negocioId}/cuenta/login`);

  // La política "cliente con cuenta ve sus propios turnos" ya filtra por
  // auth.uid() — el filtro por negocio_id acá es solo para esta vista
  // puntual (si la misma cuenta tuviera turnos en otro negocio, no
  // aparecerían mezclados en esta pantalla).
  const { data: turnos } = await supabase
    .from("turnos")
    .select("id, inicio, estado, token_acceso, servicios(nombre)")
    .eq("negocio_id", negocioId)
    .order("inicio", { ascending: true });

  // Próximos: confirmados que todavía no empezaron (del más cercano al más
  // lejano). Todo lo demás —pasados, atendidos, cancelados— va al
  // historial, del más reciente al más viejo.
  const ahora = Date.now();
  const lista = (turnos ?? []) as unknown as TurnoCliente[];
  const proximos = lista.filter(
    (t) => t.estado === "confirmado" && new Date(t.inicio).getTime() >= ahora,
  );
  const anteriores = lista
    .filter((t) => !proximos.includes(t))
    .reverse();

  return (
    <main className="min-h-screen px-6 py-10 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl text-bosque-800">Mis turnos</h1>
        <CerrarSesionBoton destino={`/r/${negocioId}`} />
      </header>

      <Link
        href={`/r/${negocioId}`}
        className="inline-block mb-6 text-sm text-arcilla-600 hover:underline"
      >
        + Reservar un turno
      </Link>

      {(!turnos || turnos.length === 0) && (
        <p className="text-bosque-500 text-sm">Todavía no tenés turnos acá.</p>
      )}

      {proximos.length > 0 && (
        <section className="mb-10">
          <h2 className="text-bosque-800 font-medium mb-2">Próximos</h2>
          <ul className="space-y-2">
            {proximos.map((turno) => (
              <li key={turno.id}>
                {/* Solo los próximos llevan al detalle: ahí se puede
                    cancelar o reprogramar, algo que no tiene sentido para
                    un turno que ya pasó. */}
                <Link
                  href={`/r/${negocioId}/turno/${turno.token_acceso}`}
                  className="block rounded-lg border border-bosque-100 bg-white px-4 py-3 hover:border-bosque-400 transition-colors"
                >
                  <p className="text-bosque-800">{nombreServicio(turno)}</p>
                  <p className="text-bosque-600 text-sm">{cuando(turno)}</p>
                  <p className="text-arcilla-600 text-xs mt-1">Ver, cancelar o reprogramar →</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {anteriores.length > 0 && (
        <section>
          <h2 className="text-bosque-800 font-medium mb-2">Anteriores y cancelados</h2>
          <ul className="space-y-2">
            {anteriores.map((turno) => (
              <li
                key={turno.id}
                className="rounded-lg border border-bosque-100 bg-white px-4 py-3 opacity-75"
              >
                <p className="text-bosque-800">{nombreServicio(turno)}</p>
                <p className="text-bosque-600 text-sm">
                  {cuando(turno)} · {etiquetaHistorial(turno.estado)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}