import { crearClienteServidor } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { alternarActivo } from "./actions";
import FormularioAgregarServicio from "./FormularioAgregarServicio";
import BotonBorrarServicio from "./BotonBorrarServicio";
import PrecioServicio from "./PrecioServicio";

export default async function ServiciosPage() {
  const supabase = await crearClienteServidor();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Una cuenta de CLIENTE también puede tener sesión (comparte el mismo
  // navegador/cookies). Sin negocio propio no hay nada que administrar acá:
  // se vuelve al panel, que muestra "No se encontró un negocio".
  const { data: negocio } = await supabase.from("negocios").select("id").single();
  if (!negocio) redirect("/dashboard");

  // Filtro explícito por negocio: desde la 0004, RLS también deja a un
  // cliente leer los servicios de SUS turnos, así que "lo que RLS deja
  // ver" ya no equivale a "los servicios de mi negocio".
  const { data: servicios } = await supabase
    .from("servicios")
    .select("id, nombre, duracion_min, activo, precio")
    .eq("negocio_id", negocio.id)
    .order("nombre");

  return (
    <main className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <Link href="/dashboard" className="text-sm text-bosque-600 hover:text-arcilla-600">
        ← Volver al panel
      </Link>

      <h1 className="font-display text-2xl text-bosque-800 mt-4 mb-8">Servicios</h1>

      <FormularioAgregarServicio />

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
              <div className="flex items-center gap-2">
                <p className="text-bosque-500 text-sm">{servicio.duracion_min} min ·</p>
                <PrecioServicio servicioId={servicio.id} precio={servicio.precio} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* .bind fija el primer argumento del lado del servidor — el
                  formulario solo necesita disparar la acción, sin mandar
                  el id por un input oculto. Esta acción no necesita mostrar
                  errores prolijos (activar/desactivar difícilmente falla),
                  así que se queda con el patrón simple. */}
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

              <BotonBorrarServicio servicioId={servicio.id} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}