import { NextResponse, type NextRequest } from "next/server";
import { crearClientePublico } from "@/lib/supabase/publico";
import { firmaWebhookValida, obtenerPago, tokenDelNegocio } from "@/lib/mp";

export const dynamic = "force-dynamic";

const ok = () => new NextResponse(null, { status: 200 });

// Avisos de Mercado Pago. Regla de oro: el aviso NO se cree. Solo dice
// "mirá el pago X"; el estado real se pide a la API de MP con el token del
// negocio, y recién eso se registra. Así, un aviso falso no puede crear
// un pago. Hay que responder 200/201 en menos de 22 s; ante un error
// propio se responde 500 para que MP reintente (cada 15 min).
export async function POST(request: NextRequest) {
  const url = request.nextUrl;
  const cuerpo = await request.json().catch(() => null);

  const tipo = cuerpo?.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const dataId = url.searchParams.get("data.id") ?? (cuerpo?.data?.id != null ? String(cuerpo.data.id) : null);

  // Firma: si viene y no coincide, se rechaza. Si no viene, se sigue igual
  // (el pago se verifica contra la API), pero queda en el log para revisar.
  const firma = request.headers.get("x-signature");
  if (firma) {
    if (!firmaWebhookValida(firma, request.headers.get("x-request-id"), dataId)) {
      console.warn("[mp webhook] firma inválida", { tipo, dataId });
      return new NextResponse(null, { status: 401 });
    }
  } else {
    console.warn("[mp webhook] aviso sin x-signature", { tipo, dataId });
  }

  // mp-connect (vinculación/desvinculación de cuentas) y otros: por ahora
  // solo se registran. TODO: al desvincular, borrar la fila de mp_cuentas
  // (falta ver el formato real del aviso en las pruebas).
  if (tipo !== "payment" || !dataId) {
    console.info("[mp webhook] ignorado", { tipo, accion: cuerpo?.action });
    return ok();
  }

  const admin = crearClientePublico();

  // ¿De qué negocio es? Primero por ?negocio= (lo pone la preferencia),
  // si no por el user_id del vendedor que trae el aviso.
  let negocioId = url.searchParams.get("negocio");
  if (!negocioId && cuerpo?.user_id != null) {
    const { data } = await admin
      .from("mp_cuentas")
      .select("negocio_id")
      .eq("mp_user_id", String(cuerpo.user_id))
      .maybeSingle();
    negocioId = data?.negocio_id ?? null;
  }
  if (!negocioId) {
    console.warn("[mp webhook] no se pudo ubicar el negocio", { dataId });
    return ok();
  }

  try {
    const token = await tokenDelNegocio(negocioId);
    if (!token) return ok(); // el negocio desconectó MP

    const pago = await obtenerPago(token.accessToken, dataId);
    if (!pago) return ok(); // pago inexistente (p. ej. una simulación)

    const referencia = pago.external_reference ?? "";
    if (!referencia.startsWith("turno:")) return ok();

    const { data: resultado, error } = await admin.rpc("registrar_pago_online", {
      negocio_id_param: negocioId,
      turno_id_param: referencia.slice("turno:".length),
      referencia_param: String(pago.id),
      monto_param: pago.transaction_amount,
      moneda_param: pago.currency_id === "USD" ? "USD" : "UYU",
      estado_mp: pago.status,
    });

    if (error?.message.includes("no encontrado")) {
      // El turno no es de este negocio (o se borró): reintentar no lo arregla.
      console.warn("[mp webhook]", error.message);
      return ok();
    }
    if (error) {
      // Falló la base: MP reintenta.
      console.error("[mp webhook] registrar_pago_online:", error.message);
      return new NextResponse(null, { status: 500 });
    }
    console.info("[mp webhook]", { pago: pago.id, estado: pago.status, resultado });
    return ok();
  } catch (e) {
    console.error("[mp webhook]", e instanceof Error ? e.message : e);
    return new NextResponse(null, { status: 500 });
  }
}
