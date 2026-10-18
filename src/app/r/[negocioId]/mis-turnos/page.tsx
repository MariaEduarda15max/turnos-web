import { crearClienteServidor } from "@/lib/supabase/server";
import { diaMontevideo, formatearFecha, horaMontevideo } from "@/lib/fechas";
import { redirect } from "next/navigation";
import Link from "next/link";
import CerrarSesionBoton from "@/components/CerrarSesionBoton";
import { formatearMonto } from "@/lib/dinero";

type TurnoCliente = {
  id: string;
  inicio: string;
  estado: "confirmado" | "cancelado" | "completado" | "ausente";
  token_acceso: string;
  // Puede venir null si RLS no deja leer el servicio (ver 0004): nunca
  // asumir que el join trae datos.
  servicios: { nombre: string; precio: number | string | null } | null;
};

type PedidoCliente = {
  id: string;
  descripcion: string;
  estado: "pendiente" | "listo" | "entregado";
  creado_en: string;
  listo_en: string | null;
  entregado_en: string | null;
  monto: number | string | null;
};

const nombreServicio = (t: TurnoCliente) => t.servicios?.nombre ?? "Servicio";

const cuando = (t: TurnoCliente) => {
  const inicio = new Date(t.inicio);
  return `${formatearFecha(diaMontevideo(inicio))} · ${horaMontevideo(inicio)}`;
};

// Un turno "confirmado" que ya pasó no se marcó como atendido: se muestra
// como "Pasado" en vez de un "Confirmado" que confunde.
const etiquetaHistorial = (estado: TurnoCliente["estado"]) =>
  estado === "cancelado"
    ? "Cancelado"
    : estado === "completado"
      ? "Atendido"
      : estado === "ausente"
        ? "No asististe"
        : "Pasado";

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
    .select("id, inicio, estado, token_acceso, servicios(nombre, precio)")
    .eq("negocio_id", negocioId)
    .order("inicio", { ascending: true });

  // Pedidos de la cuenta en este negocio. RLS ("cliente con cuenta ve sus
  // propios pedidos") ya limita a los suyos. Los entregados se muestran
  // solo 30 días.
  const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: pedidosData } = await supabase
    .from("pedidos")
    .select("id, descripcion, estado, creado_en, listo_en, entregado_en, monto")
    .eq("negocio_id", negocioId)
    // Comillas: el timestamp lleva "." y ":", que el filtro or() de
    // PostgREST podría interpretar como separadores.
    .or(`estado.neq.entregado,entregado_en.gte."${hace30Dias}"`)
    .order("creado_en", { ascending: false });
  const pedidos = (pedidosData ?? []) as unknown as PedidoCliente[];

  // Próximos: confirmados que todavía no empezaron (del más cercano al más
  // lejano). Todo lo demás —pasados, atendidos, cancelados— va al
  // historial, del más reciente al más viejo.
  const ahora = Date.now();
  const lista = (turnos ?? []) as unknown as TurnoCliente[];
  const proximos = lista.filter(
    (t) => t.estado === "confirmado" && new Date(t.inicio).getTime() >= ahora,
  );
  const anteriores = lista
    .filter((t) => !proximos.includes(t))
    .reverse();

  // Pagos (aprobados) de sus turnos y pedidos. RLS ("cliente ve pagos de
  // sus turnos y pedidos", 0009) ya limita a los suyos.
  const pagadoPor = new Map<string, number>();
  // Solo se arman los filtros que tienen ids (un "in.()" vacío falla).
  const filtros = [
    lista.length > 0 ? `turno_id.in.(${lista.map((t) => t.id).join(",")})` : null,
    pedidos.length > 0 ? `pedido_id.in.(${pedidos.map((p) => p.id).join(",")})` : null,
  ].filter(Boolean);
  if (filtros.length > 0) {
    const { data: pagos } = await supabase
      .from("pagos")
      .select("turno_id, pedido_id, monto")
      .eq("estado", "aprobado")
      .or(filtros.join(","));
    for (const pago of pagos ?? []) {
      const clave = (pago.turno_id ?? pago.pedido_id) as string;
      pagadoPor.set(clave, (pagadoPor.get(clave) ?? 0) + Number(pago.monto));
    }
  }

  // "Pagado", "Pagaste $X · falta $Y" o nada si no hay pagos ni precio.
  const estadoPago = (id: string, total: number | string | null) => {
    const pagado = pagadoPor.get(id) ?? 0;
    const totalNum = total === null ? null : Number(total);
    if (totalNum !== null && pagado >= totalNum && pagado > 0) return "Pagado";
    if (pagado > 0) {
      return totalNum !== null
        ? `Pagaste ${formatearMonto(pagado)} · falta ${formatearMonto(totalNum - pagado)}`
        : `Pagaste ${formatearMonto(pagado)}`;
    }
    return totalNum !== null ? `Precio ${formatearMonto(totalNum)}` : null;
  };

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

      {pedidos.length > 0 && (
        <section className="mb-10">
          <h2 className="text-bosque-800 font-medium mb-2">Mis pedidos</h2>
          <ul className="space-y-2">
            {pedidos.map((p) => (
              <li key={p.id} className="rounded-lg border border-bosque-100 bg-white px-4 py-3">
                <p className="text-bosque-800">{p.descripcion}</p>
                <p
                  className={`text-sm ${
                    p.estado === "listo" ? "text-arcilla-600 font-medium" : "text-bosque-600"
                  }`}
                >
                  {p.estado === "pendiente" && "En preparación"}
                  {p.estado === "listo" && "¡Listo para retirar!"}
                  {p.estado === "entregado" && "Entregado"}
                </p>
                {estadoPago(p.id, p.monto) && (
                  <p className="text-bosque-500 text-xs mt-1">{estadoPago(p.id, p.monto)}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(!turnos || turnos.length === 0) && (
        <p className="text-bosque-500 text-sm">Todavía no tenés turnos acá.</p>
      )}

      {proximos.length > 0 && (
        <section className="mb-10">
          <h2 className="text-bosque-800 font-medium mb-2">Próximos</h2>
          <ul className="space-y-2">
            {proximos.map((turno) => (
              <li key={turno.id}>
                {/* Solo los próximos llevan al detalle: ahí se puede
                    cancelar o reprogramar, algo que no tiene sentido para
                    un turno que ya pasó. */}
                <Link
                  href={`/r/${negocioId}/turno/${turno.token_acceso}`}
                  className="block rounded-lg border border-bosque-100 bg-white px-4 py-3 hover:border-bosque-400 transition-colors"
                >
                  <p className="text-bosque-800">{nombreServicio(turno)}</p>
                  <p className="text-bosque-600 text-sm">{cuando(turno)}</p>
                  {estadoPago(turno.id, turno.servicios?.precio ?? null) && (
                    <p className="text-bosque-500 text-xs">{estadoPago(turno.id, turno.servicios?.precio ?? null)}</p>
                  )}
                  <p className="text-arcilla-600 text-xs mt-1">Ver, cancelar o reprogramar →</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {anteriores.length > 0 && (
        <section>
          <h2 className="text-bosque-800 font-medium mb-2">Anteriores y cancelados</h2>
          <ul className="space-y-2">
            {anteriores.map((turno) => (
              <li
                key={turno.id}
                className="rounded-lg border border-bosque-100 bg-white px-4 py-3 opacity-75"
              >
                <p className="text-bosque-800">{nombreServicio(turno)}</p>
                <p className="text-bosque-600 text-sm">
                  {cuando(turno)} · {etiquetaHistorial(turno.estado)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}