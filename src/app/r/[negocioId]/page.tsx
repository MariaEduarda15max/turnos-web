import { crearClientePublico } from "@/lib/supabase/publico";
import { formatearFecha } from "@/lib/fechas";
import { calcularHorariosLibres, diasConDisponibilidad } from "@/lib/slots";
import FormularioReserva from "./FormularioReserva";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ negocioId: string }>;
  searchParams: Promise<{ servicioId?: string; dia?: string }>;
};

export default async function ReservarPage({ params, searchParams }: Props) {
  const { negocioId } = await params;
  const { servicioId, dia } = await searchParams;

  // Cliente con la secret key — bypasea RLS a propósito acá (ver
  // publico.ts). El código, no la base, decide qué se expone.
  const supabase = crearClientePublico();

  const { data: negocio } = await supabase
    .from("negocios")
    .select("id, nombre")
    .eq("id", negocioId)
    .maybeSingle();

  if (!negocio) notFound();

  // --- Paso 1: sin servicio elegido → listar servicios activos ---------
  if (!servicioId) {
    const { data: servicios } = await supabase
      .from("servicios")
      .select("id, nombre, duracion_min")
      .eq("negocio_id", negocioId)
      .eq("activo", true)
      .order("nombre");

    return (
      <Layout negocioNombre={negocio.nombre} paso={1}>
        {(!servicios || servicios.length === 0) && (
          <p className="text-bosque-500 text-sm">
            Este negocio no tiene servicios disponibles en este momento.
          </p>
        )}
        <ul className="space-y-2">
          {servicios?.map((s) => (
            <li key={s.id}>
              <Link
                href={`/r/${negocioId}?servicioId=${s.id}`}
                className="block rounded-lg border border-bosque-100 bg-white px-4 py-3 hover:border-bosque-400 transition-colors"
              >
                <p className="text-bosque-800">{s.nombre}</p>
                <p className="text-bosque-500 text-sm">{s.duracion_min} min</p>
              </Link>
            </li>
          ))}
        </ul>
      </Layout>
    );
  }

  const { data: servicio } = await supabase
    .from("servicios")
    .select("id, nombre, duracion_min")
    .eq("id", servicioId)
    .eq("negocio_id", negocioId) // el servicio tiene que ser DE ESTE negocio
    .maybeSingle();

  if (!servicio) notFound();

  // --- Paso 2: servicio elegido, sin día → listar próximos días --------
  if (!dia) {
    const diasDisponibles = await diasConDisponibilidad(supabase, negocioId);

    return (
      <Layout negocioNombre={negocio.nombre} paso={2} servicioNombre={servicio.nombre}>
        {diasDisponibles.length === 0 && (
          <p className="text-bosque-500 text-sm">No hay días disponibles por ahora.</p>
        )}
        <ul className="space-y-2">
          {diasDisponibles.map((d) => (
            <li key={d}>
              <Link
                href={`/r/${negocioId}?servicioId=${servicioId}&dia=${d}`}
                className="block rounded-lg border border-bosque-100 bg-white px-4 py-3 hover:border-bosque-400 transition-colors capitalize"
              >
                {formatearFecha(d)}
              </Link>
            </li>
          ))}
        </ul>
      </Layout>
    );
  }

  // --- Paso 3: día elegido → calcular horarios libres y reservar --------
  const horarios = await calcularHorariosLibres(supabase, negocioId, servicioId, dia);

  return (
    <Layout negocioNombre={negocio.nombre} paso={3} servicioNombre={servicio.nombre}>
      <p className="text-bosque-600 text-sm mb-4 capitalize">{formatearFecha(dia)}</p>
      <FormularioReserva
        negocioId={negocioId}
        servicioId={servicioId}
        dia={dia}
        horarios={horarios}
      />
    </Layout>
  );
}

function Layout({
  children,
  negocioNombre,
  servicioNombre,
  paso,
}: {
  children: React.ReactNode;
  negocioNombre: string;
  servicioNombre?: string;
  paso: 1 | 2 | 3;
}) {
  return (
    <main className="min-h-screen px-6 py-10 max-w-md mx-auto">
      <h1 className="font-display text-2xl text-bosque-800 mb-1">{negocioNombre}</h1>
      <p className="text-bosque-500 text-sm mb-8">
        {paso === 1 && "Elegí un servicio"}
        {paso === 2 && `${servicioNombre} — elegí un día`}
        {paso === 3 && `${servicioNombre} — elegí un horario`}
      </p>
      {children}
    </main>
  );
}