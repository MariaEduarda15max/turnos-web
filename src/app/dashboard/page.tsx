import { crearClienteServidor } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import CerrarSesionBoton from "@/components/CerrarSesionBoton";

export default async function DashboardPage() {
  const supabase = await crearClienteServidor();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Gracias a la política de RLS "negocio ve y edita su propio registro",
  // esta consulta SOLO puede devolver la fila de este usuario — no hace
  // falta filtrar por auth_user_id acá, Postgres ya lo hace por nosotros.
  const { data: negocio, error } = await supabase
    .from("negocios")
    .select("id, nombre, email_admin, creado_en")
    .single();

  return (
    <main className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-10">
        <h1 className="font-display text-2xl text-bosque-800">
          {negocio?.nombre ?? "Panel"}
        </h1>
        <CerrarSesionBoton />
      </header>

      {error && (
        <p className="text-arcilla-600 text-sm">
          No se encontró un negocio registrado para esta cuenta.
        </p>
      )}

      {negocio && (
        <div className="rounded-lg border border-bosque-100 bg-white p-6 space-y-2">
          <p className="text-bosque-700">
            <span className="text-bosque-500 text-sm">Email de contacto:</span>{" "}
            {negocio.email_admin}
          </p>
          <p className="text-bosque-700">
            <span className="text-bosque-500 text-sm">Registrado el:</span>{" "}
            {new Date(negocio.creado_en).toLocaleDateString("es-UY")}
          </p>
          {/* Los clientes no entran por la home (que es del negocio): entran
              por este link, que el negocio comparte. Desde ahí pueden
              reservar como invitados o crearse una cuenta. */}
          <p className="text-bosque-700">
            <span className="text-bosque-500 text-sm">Link de reservas para tus clientes:</span>{" "}
            <Link href={`/r/${negocio.id}`} className="text-arcilla-600 hover:underline break-all">
              /r/{negocio.id}
            </Link>
          </p>
          <p className="pt-2">
            <Link href="/dashboard/negocio" className="text-sm text-arcilla-600 hover:underline">
              Editar datos del negocio
            </Link>
          </p>
        </div>
      )}

      <nav className="flex gap-3 mt-8">
        <Link
          href="/dashboard/turnos"
          className="rounded-md border border-bosque-100 bg-white px-4 py-2 text-sm text-bosque-700 hover:border-bosque-400 transition-colors"
        >
          Turnos
        </Link>
        <Link
          href="/dashboard/pedidos"
          className="rounded-md border border-bosque-100 bg-white px-4 py-2 text-sm text-bosque-700 hover:border-bosque-400 transition-colors"
        >
          Pedidos
        </Link>
        <Link
          href="/dashboard/servicios"
          className="rounded-md border border-bosque-100 bg-white px-4 py-2 text-sm text-bosque-700 hover:border-bosque-400 transition-colors"
        >
          Servicios
        </Link>
        <Link
          href="/dashboard/horarios"
          className="rounded-md border border-bosque-100 bg-white px-4 py-2 text-sm text-bosque-700 hover:border-bosque-400 transition-colors"
        >
          Horarios
        </Link>
      </nav>

    </main>
  );
}