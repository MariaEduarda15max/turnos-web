import { crearClienteServidor } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { crearServicio, alternarActivo, borrarServicio } from "./actions";

export default async function ServiciosPage() {
  const supabase = await crearClienteServidor();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS filtra automáticamente por negocio_actual() — esta consulta solo
  // puede devolver los servicios de ESTE negocio, nunca los de otro.
  const { data: servicios } = await supabase
    .from("servicios")
    .select("id, nombre, duracion_min, activo")
    .order("nombre");

  return (
    <main className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <Link href="/dashboard" className="text-sm text-bosque-600 hover:text-arcilla-600">
        ← Volver al panel
      </Link>

      <h1 className="font-display text-2xl text-bosque-800 mt-4 mb-8">Servicios</h1>

      <form action={crearServicio} className="rounded-lg border border-bosque-100 bg-white p-5 mb-8 space-y-3">
        <h2 className="text-bosque-700 font-medium text-sm">Agregar servicio</h2>
        <div className="flex gap-3">
          <input
            name="nombre"
            type="text"
            placeholder="Nombre (ej. Corte)"
            required
            className="flex-1 rounded-md border border-bosque-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque-400"
          />
          <input
            name="duracion_min"
            type="number"
            placeholder="Minutos"
            required
            min={1}
            className="w-28 rounded-md border border-bosque-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque-400"
          />
          <button
            type="submit"
            className="rounded-md bg-bosque-800 text-white px-4 py-2 text-sm font-medium hover:bg-bosque-900 transition-colors"
          >
            Agregar
          </button>
        </div>
      </form>

      {(!servicios || servicios.length === 0) && (
        <p className="text-bosque-500 text-sm">Todavía no cargaste ningún servicio.</p>
      )}

      <ul className="space-y-2">
        {servicios?.map((servicio) => (
          <li
            key={servicio.id}
            className="flex items-center justify-between rounded-lg border border-bosque-100 bg-white px-4 py-3"
          >
            <div>
              <p className="text-bosque-800">{servicio.nombre}</p>
              <p className="text-bosque-500 text-sm">{servicio.duracion_min} min</p>
            </div>

            <div className="flex items-center gap-2">
              {/* .bind fija el primer argumento del lado del servidor — el
                  formulario solo necesita disparar la acción, sin mandar
                  el id por un input oculto. */}
              <form action={alternarActivo.bind(null, servicio.id, servicio.activo)}>
                <button
                  type="submit"
                  className={`text-sm rounded-md px-3 py-1 ${
                    servicio.activo
                      ? "bg-bosque-100 text-bosque-700"
                      : "bg-arcilla-400/20 text-arcilla-600"
                  }`}
                >
                  {servicio.activo ? "Activo" : "Inactivo"}
                </button>
              </form>

              <form action={borrarServicio.bind(null, servicio.id)}>
                <button
                  type="submit"
                  className="text-sm text-bosque-400 hover:text-arcilla-600 px-2"
                  title="Borrar"
                >
                  ✕
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}