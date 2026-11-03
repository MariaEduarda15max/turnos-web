import { crearClienteServidor } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import FormularioCobro from "./FormularioCobro";
import { desconectarMercadoPago } from "./actions";

// Mensajes de la vuelta del OAuth (/api/mp/oauth/callback?…→ ?mp=…).
const MENSAJE_OAUTH: Record<string, { texto: string; error: boolean }> = {
  conectado: { texto: "¡Listo! Mercado Pago quedó conectado.", error: false },
  cancelado: { texto: "Cancelaste la conexión con Mercado Pago.", error: true },
  vencido: { texto: "La conexión tardó demasiado o se abrió en otra pestaña. Probá de nuevo.", error: true },
  cuenta_en_uso: { texto: "Esa cuenta de Mercado Pago ya está conectada a otro negocio.", error: true },
  error: { texto: "No se pudo conectar Mercado Pago. Probá de nuevo en un rato.", error: true },
};

type EstadoConexion = {
  conectado: boolean;
  mp_user_id: string;
  modo_prueba: boolean;
  token_expira_en: string;
};

export default async function CobrosPage({
  searchParams,
}: {
  searchParams: Promise<{ mp?: string }>;
}) {
  const { mp } = await searchParams;
  const supabase = await crearClienteServidor();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: negocio } = await supabase
    .from("negocios")
    .select("cobro_modo, sena_tipo, sena_valor")
    .single();
  if (!negocio) redirect("/dashboard");

  // Solo el estado de la conexión: los tokens nunca salen de la base.
  const { data: conexiones } = await supabase.rpc("mp_estado_conexion");
  const conexion = ((conexiones ?? []) as EstadoConexion[])[0] ?? null;

  // Servicios sin precio: con "total" o seña en %, esos no se cobran online.
  const { count: sinPrecio } = await supabase
    .from("servicios")
    .select("id", { count: "exact", head: true })
    .eq("activo", true)
    .is("precio", null);

  const aviso = mp ? MENSAJE_OAUTH[mp] : undefined;
  const cobraOnline = negocio.cobro_modo !== "no_cobrar";
  const necesitaPrecio =
    negocio.cobro_modo === "total" || (negocio.cobro_modo === "sena" && negocio.sena_tipo === "porcentaje");

  return (
    <main className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <Link href="/dashboard" className="text-sm text-bosque-600 hover:text-arcilla-600">
        ← Volver al panel
      </Link>

      <h1 className="font-display text-2xl text-bosque-800 mt-4 mb-8">Cobros online</h1>

      {aviso && (
        <p
          className={`rounded-md px-3 py-2 text-sm mb-6 ${
            aviso.error ? "border border-arcilla-400 text-arcilla-600" : "bg-bosque-50 text-bosque-700"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      <section className="mb-10">
        <h2 className="text-bosque-800 font-medium mb-2">Mercado Pago</h2>
        <div className="rounded-lg border border-bosque-100 bg-white p-6 space-y-3">
          {conexion ? (
            <>
              <p className="text-bosque-700 text-sm">
                ✅ Conectado (cuenta {conexion.mp_user_id}
                {conexion.modo_prueba ? ", modo prueba" : ""}). Lo que cobres va directo a esa cuenta.
              </p>
              <form action={desconectarMercadoPago}>
                <button type="submit" className="text-sm text-arcilla-600 hover:underline">
                  Desconectar
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-bosque-600 text-sm">
                Conectá tu cuenta para cobrar señas o el total al reservar. La plata va directo a tu
                Mercado Pago.
              </p>
              {/* <a> y no <Link>: es una ruta que redirige a Mercado Pago. */}
              <a
                href="/api/mp/oauth/iniciar"
                className="inline-block rounded-md bg-bosque-800 text-white px-4 py-2 text-sm font-medium hover:bg-bosque-900 transition-colors"
              >
                Conectar Mercado Pago
              </a>
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-bosque-800 font-medium mb-2">Al reservar</h2>
        {cobraOnline && !conexion && (
          <p className="text-arcilla-600 text-sm mb-3">
            Mientras no conectes Mercado Pago, las reservas se confirman sin cobrar.
          </p>
        )}
        {cobraOnline && necesitaPrecio && (sinPrecio ?? 0) > 0 && (
          <p className="text-arcilla-600 text-sm mb-3">
            {sinPrecio} servicio(s) no tienen precio: esos se reservan sin cobrar.{" "}
            <Link href="/dashboard/servicios" className="underline">
              Cargar precios
            </Link>
          </p>
        )}
        <FormularioCobro
          modo={negocio.cobro_modo}
          senaTipo={negocio.sena_tipo}
          senaValor={negocio.sena_valor}
        />
      </section>
    </main>
  );
}
