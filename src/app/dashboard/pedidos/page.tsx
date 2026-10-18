import { crearClienteServidor } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { diaMontevideo, formatearFecha, horaMontevideo } from "@/lib/fechas";
import FormularioPedido from "./FormularioPedido";
import AccionPedido from "./AccionPedido";
import EditarBorrarPedido from "./EditarBorrarPedido";
import PanelPagos from "../pagos/PanelPagos";
import { formatearMonto, type PagoResumen } from "@/lib/dinero";

type Pedido = {
  id: string;
  descripcion: string;
  estado: "pendiente" | "listo" | "entregado";
  creado_en: string;
  listo_en: string | null;
  entregado_en: string | null;
  monto: number | string | null;
  clientes: { nombre: string; email: string | null; telefono: string | null } | null;
};

const cuando = (iso: string) => {
  const fecha = new Date(iso);
  return `${formatearFecha(diaMontevideo(fecha))} · ${horaMontevideo(fecha)}`;
};

export default async function PedidosPage() {
  const supabase = await crearClienteServidor();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: negocio } = await supabase.from("negocios").select("id").single();
  if (!negocio) redirect("/dashboard");

  // Entregados: solo los últimos 30 días, para que la lista no crezca sin fin.
  const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: abiertos, error }, { data: entregados }] = await Promise.all([
    supabase
      .from("pedidos")
      .select("id, descripcion, estado, monto, creado_en, listo_en, entregado_en, clientes(nombre, email, telefono)")
      .eq("negocio_id", negocio.id)
      .in("estado", ["pendiente", "listo"])
      .order("creado_en", { ascending: true }),
    supabase
      .from("pedidos")
      .select("id, descripcion, estado, monto, creado_en, listo_en, entregado_en, clientes(nombre, email, telefono)")
      .eq("negocio_id", negocio.id)
      .eq("estado", "entregado")
      .gte("entregado_en", hace30Dias)
      .order("entregado_en", { ascending: false })
      .limit(100),
  ]);

  const lista = (abiertos ?? []) as unknown as Pedido[];
  const pendientes = lista.filter((p) => p.estado === "pendiente");
  const listos = lista.filter((p) => p.estado === "listo");
  const historial = (entregados ?? []) as unknown as Pedido[];

  // Pagos aprobados de todos los pedidos de la página, agrupados.
  const todos = [...lista, ...historial];
  const pagosPorPedido = new Map<string, PagoResumen[]>();
  if (todos.length > 0) {
    const { data: pagos } = await supabase
      .from("pagos")
      .select("id, pedido_id, monto, metodo, nota, creado_en")
      .in("pedido_id", todos.map((p) => p.id))
      .eq("estado", "aprobado")
      .order("creado_en");
    for (const pago of (pagos ?? []) as (PagoResumen & { pedido_id: string })[]) {
      if (!pagosPorPedido.has(pago.pedido_id)) pagosPorPedido.set(pago.pedido_id, []);
      pagosPorPedido.get(pago.pedido_id)!.push(pago);
    }
  }

  const tarjeta = (p: Pedido, detalle: string, siguiente?: "listo" | "entregado") => {
    const contacto = [p.clientes?.email, p.clientes?.telefono].filter(Boolean).join(" · ");
    return (
      <li key={p.id} className="flex items-start justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <p className="text-bosque-800">
            {p.descripcion}
            {p.monto !== null && <span className="text-bosque-500 text-sm"> · {formatearMonto(p.monto)}</span>}
          </p>
          <p className="text-bosque-600 text-sm">{p.clientes?.nombre ?? "Cliente"}</p>
          {contacto && <p className="text-bosque-400 text-xs break-all">{contacto}</p>}
          <p className="text-bosque-400 text-xs mt-1">{detalle}</p>
          <PanelPagos
            tipo="pedido"
            destinoId={p.id}
            pagos={pagosPorPedido.get(p.id) ?? []}
            total={p.monto}
          />
          {/* Los entregados quedan como historial: no se editan ni se borran. */}
          {p.estado !== "entregado" && (
            <EditarBorrarPedido pedidoId={p.id} descripcion={p.descripcion} monto={p.monto} />
          )}
        </div>
        {siguiente && <AccionPedido pedidoId={p.id} siguiente={siguiente} />}
      </li>
    );
  };

  const seccion = (titulo: string, items: Pedido[], vacio: string, render: (p: Pedido) => React.ReactNode) => (
    <section className="mb-10">
      <h2 className="text-bosque-800 font-medium mb-2">
        {titulo} <span className="text-bosque-400 text-sm">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="text-bosque-400 text-sm">{vacio}</p>
      ) : (
        <ul className="rounded-lg border border-bosque-100 bg-white divide-y divide-bosque-100">
          {items.map(render)}
        </ul>
      )}
    </section>
  );

  return (
    <main className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <Link href="/dashboard" className="text-sm text-bosque-600 hover:text-arcilla-600">
        ← Volver al panel
      </Link>

      <h1 className="font-display text-2xl text-bosque-800 mt-4 mb-6">Pedidos</h1>

      {error && (
        <p className="text-arcilla-600 text-sm mb-4">No se pudieron cargar los pedidos: {error.message}</p>
      )}

      <FormularioPedido />

      {seccion("Pendientes", pendientes, "No hay pedidos pendientes.", (p) =>
        tarjeta(p, `Cargado: ${cuando(p.creado_en)}`, "listo"),
      )}
      {seccion("Listos para retirar", listos, "No hay pedidos esperando retiro.", (p) =>
        tarjeta(p, `Listo desde: ${p.listo_en ? cuando(p.listo_en) : "—"}`, "entregado"),
      )}
      {seccion("Entregados (últimos 30 días)", historial, "Todavía no hay pedidos entregados.", (p) =>
        tarjeta(p, `Entregado: ${p.entregado_en ? cuando(p.entregado_en) : "—"}`),
      )}

      <p className="text-bosque-400 text-xs">
        Por ahora el cliente no recibe un aviso por email cuando el pedido está listo: lo ve en su
        sección "Mis turnos" si tiene cuenta. El aviso por email llega cuando esté configurado el
        dominio propio.
      </p>
    </main>
  );
}
