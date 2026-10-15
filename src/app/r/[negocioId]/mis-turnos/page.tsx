import { crearClienteServidor } from "@/lib/supabase/server";
import { diaMontevideo, formatearFecha, horaMontevideo } from "@/lib/fechas";
import { redirect } from "next/navigation";
import Link from "next/link";
import CerrarSesionBoton from "@/components/CerrarSesionBoton";

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
    .order("inicio", { ascending: false });

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

      <ul className="space-y-2">
        {turnos?.map((turno) => {
          // servicios puede venir null si RLS no deja leer la fila (ver 0004) —
          // nunca asumir que el join trae datos.
          const servicio = turno.servicios as unknown as { nombre: string } | null;
          return (
            <li key={turno.id}>
              <Link
                href={`/r/${negocioId}/turno/${turno.token_acceso}`}
                className="block rounded-lg border border-bosque-100 bg-white px-4 py-3 hover:border-bosque-400 transition-colors"
              >
                <p className="text-bosque-800">{servicio?.nombre ?? "Servicio"}</p>
                <p className="text-bosque-500 text-sm">
                  {formatearFecha(diaMontevideo(new Date(turno.inicio)))} ·{" "}
                  {horaMontevideo(new Date(turno.inicio))} ·{" "}
                  {turno.estado.charAt(0).toUpperCase() + turno.estado.slice(1)}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}