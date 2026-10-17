import { crearClienteServidor } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  diaMontevideo,
  fechaMontevideo,
  formatearFecha,
  horaMontevideo,
} from "@/lib/fechas";
import AccionesTurno from "./AccionesTurno";

type Turno = {
  id: string;
  inicio: string;
  duracion_min: number;
  estado: "confirmado" | "cancelado" | "completado" | "ausente";
  servicios: { nombre: string } | null;
  clientes: { nombre: string; email: string | null; telefono: string | null } | null;
};

const ETIQUETA_ESTADO: Record<Turno["estado"], { texto: string; clase: string }> = {
  confirmado: { texto: "Confirmado", clase: "bg-bosque-50 text-bosque-600" },
  cancelado: { texto: "Cancelado", clase: "border border-arcilla-400 text-arcilla-600" },
  completado: { texto: "Atendido", clase: "bg-bosque-100 text-bosque-800" },
  ausente: { texto: "No vino", clase: "border border-bosque-400 text-bosque-600" },
};

export default async function TurnosPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { ver } = await searchParams;
  const anteriores = ver === "anteriores";

  const supabase = await crearClienteServidor();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Una sesión de CLIENTE no tiene negocio: no hay agenda que mostrar.
  const { data: negocio } = await supabase.from("negocios").select("id").single();
  if (!negocio) redirect("/dashboard");

  // "Hoy" según Montevideo, no según el reloj del servidor (UTC).
  const ahora = new Date();
  const inicioDeHoy = fechaMontevideo(diaMontevideo(ahora), "00:00");
  const hace30Dias = new Date(inicioDeHoy.getTime() - 30 * 24 * 60 * 60 * 1000);

  let consulta = supabase
    .from("turnos")
    .select(
      "id, inicio, duracion_min, estado, servicios(nombre), clientes(nombre, email, telefono)",
    )
    .eq("negocio_id", negocio.id)
    .limit(300);

  consulta = anteriores
    ? consulta
        .lt("inicio", inicioDeHoy.toISOString())
        .gte("inicio", hace30Dias.toISOString())
        .order("inicio", { ascending: false })
    : consulta.gte("inicio", inicioDeHoy.toISOString()).order("inicio", { ascending: true });

  const { data, error } = await consulta;
  const turnos = (data ?? []) as unknown as Turno[];

  // Agrupar por día (de Montevideo) manteniendo el orden de la consulta.
  const porDia = new Map<string, Turno[]>();
  for (const t of turnos) {
    const dia = diaMontevideo(new Date(t.inicio));
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia)!.push(t);
  }

  const pestaña = (activa: boolean) =>
    `text-sm px-3 py-1 rounded-md ${
      activa ? "bg-bosque-800 text-white" : "text-bosque-600 hover:text-arcilla-600"
    }`;

  return (
    <main className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <Link href="/dashboard" className="text-sm text-bosque-600 hover:text-arcilla-600">
        ← Volver al panel
      </Link>

      <h1 className="font-display text-2xl text-bosque-800 mt-4 mb-6">Turnos</h1>

      <nav className="flex gap-2 mb-8">
        <Link href="/dashboard/turnos" className={pestaña(!anteriores)}>
          Próximos
        </Link>
        <Link href="/dashboard/turnos?ver=anteriores" className={pestaña(anteriores)}>
          Últimos 30 días
        </Link>
      </nav>

      {error && (
        <p className="text-arcilla-600 text-sm mb-4">No se pudieron cargar los turnos: {error.message}</p>
      )}

      {!error && turnos.length === 0 && (
        <p className="text-bosque-500 text-sm">
          {anteriores ? "No hubo turnos en los últimos 30 días." : "No hay turnos próximos."}
        </p>
      )}

      <div className="space-y-8">
        {[...porDia.entries()].map(([dia, delDia]) => (
          <section key={dia}>
            <h2 className="text-bosque-800 font-medium mb-2">{formatearFecha(dia)}</h2>
            <ul className="rounded-lg border border-bosque-100 bg-white divide-y divide-bosque-100">
              {delDia.map((t) => {
                const inicio = new Date(t.inicio);
                const fin = new Date(inicio.getTime() + t.duracion_min * 60_000);
                const etiqueta = ETIQUETA_ESTADO[t.estado];
                const contacto = [t.clientes?.email, t.clientes?.telefono].filter(Boolean).join(" · ");
                return (
                  <li
                    key={t.id}
                    className={`flex items-start justify-between gap-4 px-4 py-3 ${
                      t.estado === "cancelado" ? "opacity-60" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-bosque-800">
                        <span className="font-medium">
                          {horaMontevideo(inicio)}–{horaMontevideo(fin)}
                        </span>{" "}
                        · {t.servicios?.nombre ?? "Servicio"}
                      </p>
                      <p className="text-bosque-600 text-sm">{t.clientes?.nombre ?? "Cliente"}</p>
                      {contacto && <p className="text-bosque-400 text-xs break-all">{contacto}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`text-xs rounded-full px-2 py-0.5 ${etiqueta.clase}`}>
                        {etiqueta.texto}
                      </span>
                      {t.estado === "confirmado" && (
                        <AccionesTurno turnoId={t.id} yaEmpezo={inicio.getTime() <= ahora.getTime()} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
