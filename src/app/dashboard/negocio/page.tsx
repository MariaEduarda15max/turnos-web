import { crearClienteServidor } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import FormularioNegocio from "./FormularioNegocio";

export default async function DatosNegocioPage() {
  const supabase = await crearClienteServidor();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: negocio } = await supabase
    .from("negocios")
    .select("nombre, email_admin")
    .single();
  if (!negocio) redirect("/dashboard");

  return (
    <main className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <Link href="/dashboard" className="text-sm text-bosque-600 hover:text-arcilla-600">
        ← Volver al panel
      </Link>

      <h1 className="font-display text-2xl text-bosque-800 mt-4 mb-8">Datos del negocio</h1>

      <FormularioNegocio nombre={negocio.nombre} emailAdmin={negocio.email_admin} />
    </main>
  );
}
