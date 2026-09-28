import { crearClienteServidor } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { crearFranja, borrarFranja, crearBloqueo, borrarBloqueo } from "./actions";

// dia_semana sigue la convención de JS Date.getDay() (0 = domingo), igual
// que turnos-bot. Se muestran de lunes a domingo, que es como piensa un
// negocio su semana.
const DIAS = [
  { valor: 1, nombre: "Lunes" },
  { valor: 2, nombre: "Martes" },
  { valor: 3, nombre: "Miércoles" },
  { valor: 4, nombre: "Jueves" },
  { valor: 5, nombre: "Viernes" },
  { valor: 6, nombre: "Sábado" },
  { valor: 0, nombre: "Domingo" },
];

// Postgres devuelve `time` como "HH:MM:SS"; para mostrar alcanza "HH:MM".
const hhmm = (hora: string) => hora.slice(0, 5);

// Por ahora la zona es fija (como en turnos-bot). Cuando haya negocios
// fuera de Uruguay, esto pasa a ser una columna de `negocios`.
const ZONA_HORARIA = "America/Montevideo";

const input =
  "rounded-md border border-bosque-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque-400";
const botonPrimario =
  "rounded-md bg-bosque-800 text-white px-4 py-2 text-sm font-medium hover:bg-bosque-900 transition-colors";

export default async function HorariosPage() {
  const supabase = await crearClienteServidor();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // "sv-SE" formatea como YYYY-MM-DD: sirve para comparar contra la
  // columna `fecha` y para el min del input de fecha.
  const hoy = new Intl.DateTimeFormat("sv-SE", { timeZone: ZONA_HORARIA }).format(new Date());

  // RLS ya limita ambas consultas a este negocio.
  const [{ data: franjas }, { data: bloqueos }] = await Promise.all([
    supabase
      .from("disponibilidad")
      .select("id, dia_semana, hora_desde, hora_hasta")
      .order("hora_desde"),
    supabase
      .from("bloqueos")
      .select("id, fecha, hora_desde, hora_hasta, motivo")
      .gte("fecha", hoy)
      .order("fecha")
      .order("hora_desde"),
  ]);

  return (
    <main className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <Link href="/dashboard" className="text-sm text-bosque-600 hover:text-arcilla-600">
        ← Volver al panel
      </Link>

      <h1 className="font-display text-2xl text-bosque-800 mt-4 mb-8">Horarios</h1>

      {/* ── Horario semanal ─────────────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="font-display text-lg text-bosque-800 mb-1">Horario semanal</h2>
        <p className="text-bosque-500 text-sm mb-4">
          Las franjas en las que se pueden reservar turnos. Si cortás al mediodía,
          cargá dos franjas (ej. 9:00–13:00 y 15:00–19:00).
        </p>

        <form action={crearFranja} className="rounded-lg border border-bosque-100 bg-white p-5 mb-4 space-y-3">
          <h3 className="text-bosque-700 font-medium text-sm">Agregar franja</h3>
          <div className="flex flex-wrap gap-3">
            <select name="dia_semana" required className={`${input} flex-1 min-w-32`}>
              {DIAS.map((d) => (
                <option key={d.valor} value={d.valor}>{d.nombre}</option>
              ))}
            </select>
            <input name="hora_desde" type="time" required aria-label="Desde" className={input} />
            <input name="hora_hasta" type="time" required aria-label="Hasta" className={input} />
            <button type="submit" className={botonPrimario}>Agregar</button>
          </div>
        </form>

        <ul className="rounded-lg border border-bosque-100 bg-white divide-y divide-bosque-100">
          {DIAS.map((dia) => {
            const delDia = franjas?.filter((f) => f.dia_semana === dia.valor) ?? [];
            return (
              <li key={dia.valor} className="flex items-center gap-4 px-4 py-3">
                <span className="w-24 text-bosque-800 text-sm">{dia.nombre}</span>
                {delDia.length === 0 ? (
                  <span className="text-bosque-400 text-sm">Cerrado</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {delDia.map((f) => (
                      <form
                        key={f.id}
                        action={borrarFranja.bind(null, f.id)}
                        className="flex items-center gap-1 rounded-md bg-bosque-50 pl-3 pr-1 py-1"
                      >
                        <span className="text-sm text-bosque-700">
                          {hhmm(f.hora_desde)}–{hhmm(f.hora_hasta)}
                        </span>
                        <button
                          type="submit"
                          className="text-xs text-bosque-400 hover:text-arcilla-600 px-1"
                          title="Borrar franja"
                        >
                          ✕
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Bloqueos ────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-display text-lg text-bosque-800 mb-1">Bloqueos</h2>
        <p className="text-bosque-500 text-sm mb-4">
          Días u horas puntuales en los que no se atiende (feriados, vacaciones, un trámite).
        </p>

        <form action={crearBloqueo} className="rounded-lg border border-bosque-100 bg-white p-5 mb-4 space-y-3">
          <h3 className="text-bosque-700 font-medium text-sm">Agregar bloqueo</h3>
          <div className="flex flex-wrap gap-3 items-center">
            <input name="fecha" type="date" required min={hoy} aria-label="Fecha" className={input} />
            <input name="hora_desde" type="time" aria-label="Desde" className={input} />
            <input name="hora_hasta" type="time" aria-label="Hasta" className={input} />
            <label className="flex items-center gap-2 text-sm text-bosque-700">
              <input name="todo_el_dia" type="checkbox" className="accent-bosque-800" />
              Todo el día
            </label>
          </div>
          <div className="flex gap-3">
            <input
              name="motivo"
              type="text"
              placeholder="Motivo (opcional)"
              className={`${input} flex-1`}
            />
            <button type="submit" className={botonPrimario}>Agregar</button>
          </div>
        </form>

        {(!bloqueos || bloqueos.length === 0) && (
          <p className="text-bosque-500 text-sm">No hay bloqueos próximos.</p>
        )}

        <ul className="space-y-2">
          {bloqueos?.map((b) => {
            const todoElDia = hhmm(b.hora_desde) === "00:00" && hhmm(b.hora_hasta) === "23:59";
            // Mediodía para que el cambio de zona horaria nunca corra la fecha.
            const fecha = new Date(`${b.fecha}T12:00:00`).toLocaleDateString("es-UY", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
            return (
              <li
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-bosque-100 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-bosque-800 capitalize">{fecha}</p>
                  <p className="text-bosque-500 text-sm">
                    {todoElDia ? "Todo el día" : `${hhmm(b.hora_desde)}–${hhmm(b.hora_hasta)}`}
                    {b.motivo && ` · ${b.motivo}`}
                  </p>
                </div>
                <form action={borrarBloqueo.bind(null, b.id)}>
                  <button
                    type="submit"
                    className="text-sm text-bosque-400 hover:text-arcilla-600 px-2"
                    title="Borrar bloqueo"
                  >
                    ✕
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
