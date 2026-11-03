import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { crearClientePublico } from "@/lib/supabase/publico";
import { montoACobrar, type ConfigCobro } from "@/lib/dinero";

// ─────────────────────────────────────────────────────────────────────────
// Mercado Pago (marketplace con OAuth) — todo lo que toca credenciales vive
// acá y SOLO corre en el servidor ("server-only" rompe el build si un Client
// Component lo importa).
//
// Verificado en la doc oficial de MP Uruguay (18/10/2026):
//   - autorización: https://auth.mercadopago.com/authorization
//   - token:        POST https://api.mercadopago.com/oauth/token
//   - el `code` dura 10 min; el access token, 180 días; el refresh token
//     exige el permiso offline_access (activado en la app).
//   - webhooks firmados con x-signature (HMAC-SHA256 de
//     "id:<data.id>;request-id:<x-request-id>;ts:<ts>;").
// NO documentado ahí (se confirma al probar): los campos exactos de la
// respuesta de /oauth/token. Por eso se leen con valores por defecto.
// ─────────────────────────────────────────────────────────────────────────

// La URL pública del sitio. redirect_uri tiene que ser IDÉNTICA a la
// registrada en la app de MP, así que el OAuth solo funciona desde Vercel
// (en localhost la cookie de PKCE queda en otro dominio).
export const SITIO_URL = (process.env.SITIO_URL ?? "https://turnos-web-liart.vercel.app").replace(/\/$/, "");
export const REDIRECT_URI = `${SITIO_URL}/api/mp/oauth/callback`;

// Mientras se prueba con cuentas de prueba, OAuth pide credenciales de
// prueba (test_token = true). Para cobrar de verdad: MP_MODO_PRUEBA=false.
export const MP_MODO_PRUEBA = process.env.MP_MODO_PRUEBA !== "false";

const API = "https://api.mercadopago.com";
const DIAS_RENOVAR_ANTES = 7;
const MS_DIA = 86_400_000;

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

// ── Cifrado de tokens (AES-256-GCM) ─────────────────────────────────────
// Formato guardado: "v1:<iv>:<tag>:<cifrado>" en base64. GCM además de
// ocultar detecta si alguien modificó el texto (el tag no coincidiría).
function clave(): Buffer {
  const k = Buffer.from(variable("MP_TOKEN_KEY"), "base64");
  if (k.length !== 32) throw new Error("MP_TOKEN_KEY tiene que ser 32 bytes en base64 (openssl rand -base64 32)");
  return k;
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", clave(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), cifrado.toString("base64")].join(":");
}

export function descifrar(guardado: string): string {
  const [version, iv, tag, cifrado] = guardado.split(":");
  if (version !== "v1" || !iv || !tag || !cifrado) throw new Error("Token cifrado con formato desconocido");
  const decipher = createDecipheriv("aes-256-gcm", clave(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(cifrado, "base64")), decipher.final()]).toString("utf8");
}

// ── OAuth con PKCE ──────────────────────────────────────────────────────
export function crearPkce() {
  // 48 bytes → 64 caracteres base64url (la doc pide 43 a 128).
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function crearState(): string {
  return randomBytes(24).toString("base64url");
}

export function urlAutorizacion(state: string, challenge: string): string {
  const url = new URL("https://auth.mercadopago.com/authorization");
  url.searchParams.set("client_id", variable("MP_CLIENT_ID"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

type RespuestaToken = {
  access_token: string;
  refresh_token?: string;
  user_id: number | string;
  public_key?: string;
  expires_in?: number;
  live_mode?: boolean;
};

async function pedirToken(cuerpo: Record<string, string>): Promise<RespuestaToken> {
  const respuesta = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: variable("MP_CLIENT_ID"),
      client_secret: variable("MP_CLIENT_SECRET"),
      ...cuerpo,
    }),
    cache: "no-store",
  });
  const json = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !json?.access_token) {
    // Nunca loguear el cuerpo completo: podría traer tokens.
    throw new Error(`MP /oauth/token respondió ${respuesta.status}: ${json?.message ?? json?.error ?? "sin detalle"}`);
  }
  return json as RespuestaToken;
}

export function canjearCodigo(code: string, verifier: string) {
  return pedirToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
    test_token: MP_MODO_PRUEBA ? "true" : "false",
  });
}

export class CuentaYaConectadaError extends Error {}

// Guarda (o reemplaza) la cuenta de MP del negocio. Usa la key secreta:
// mp_cuentas tiene RLS sin políticas, nadie más puede escribirla.
export async function guardarCuenta(negocioId: string, t: RespuestaToken) {
  if (!t.refresh_token) {
    throw new Error("MP no devolvió refresh_token: revisá que la app tenga el permiso offline_access");
  }
  const admin = crearClientePublico();
  const { error } = await admin.from("mp_cuentas").upsert(
    {
      negocio_id: negocioId,
      mp_user_id: String(t.user_id),
      access_token_cifrado: cifrar(t.access_token),
      refresh_token_cifrado: cifrar(t.refresh_token),
      public_key: t.public_key ?? null,
      modo_prueba: MP_MODO_PRUEBA,
      token_expira_en: new Date(Date.now() + (t.expires_in ?? 180 * 86_400) * 1000).toISOString(),
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "negocio_id" },
  );
  // mp_user_id es único: la misma cuenta de MP no puede cobrar para dos negocios.
  if (error?.code === "23505") throw new CuentaYaConectadaError("Esa cuenta de Mercado Pago ya está conectada a otro negocio.");
  if (error) throw new Error(`No se pudo guardar la cuenta de MP: ${error.message}`);
}

// Devuelve el access token del negocio, renovándolo si vence en menos de
// 7 días. null = el negocio no conectó Mercado Pago.
export async function tokenDelNegocio(
  negocioId: string,
): Promise<{ accessToken: string; mpUserId: string } | null> {
  const admin = crearClientePublico();
  const { data: cuenta } = await admin
    .from("mp_cuentas")
    .select("mp_user_id, access_token_cifrado, refresh_token_cifrado, token_expira_en")
    .eq("negocio_id", negocioId)
    .maybeSingle();
  if (!cuenta) return null;

  const venceEn = new Date(cuenta.token_expira_en).getTime() - Date.now();
  if (venceEn > DIAS_RENOVAR_ANTES * MS_DIA) {
    return { accessToken: descifrar(cuenta.access_token_cifrado), mpUserId: cuenta.mp_user_id };
  }

  // Cada renovación trae un refresh token NUEVO: hay que guardarlo siempre.
  const nuevo = await pedirToken({
    grant_type: "refresh_token",
    refresh_token: descifrar(cuenta.refresh_token_cifrado),
  });
  await guardarCuenta(negocioId, { ...nuevo, refresh_token: nuevo.refresh_token ?? descifrar(cuenta.refresh_token_cifrado) });
  return { accessToken: nuevo.access_token, mpUserId: String(nuevo.user_id ?? cuenta.mp_user_id) };
}

// ── Preferencias (Checkout Pro) ─────────────────────────────────────────
// MP pide fechas con offset ("2026-11-02T21:30:00.000-03:00"). Uruguay no
// tiene horario de verano, así que el offset es fijo.
function fechaMp(fecha: Date): string {
  return new Date(fecha.getTime() - 3 * 3_600_000).toISOString().replace("Z", "-03:00");
}

export async function crearPreferencia(
  accessToken: string,
  datos: {
    negocioId: string;
    turnoId: string;
    titulo: string;
    monto: number;
    emailPagador: string | null;
    venceEn: Date;
    urlVuelta: string;
  },
): Promise<{ id: string; linkPago: string }> {
  const cuerpo = {
    items: [
      { id: datos.turnoId, title: datos.titulo, quantity: 1, unit_price: datos.monto, currency_id: "UYU" },
    ],
    external_reference: `turno:${datos.turnoId}`,
    // ?negocio= para ubicar al vendedor sin depender del user_id del aviso.
    notification_url: `${SITIO_URL}/api/mp/webhook?negocio=${datos.negocioId}`,
    back_urls: { success: datos.urlVuelta, pending: datos.urlVuelta, failure: datos.urlVuelta },
    auto_return: "approved",
    // El link de pago muere junto con la reserva retenida.
    expires: true,
    expiration_date_from: fechaMp(new Date()),
    expiration_date_to: fechaMp(datos.venceEn),
    // Comisión de la plataforma: 0 por ahora (decisión 18/10, el ingreso
    // es la suscripción de la etapa 3).
    marketplace_fee: 0,
    ...(datos.emailPagador ? { payer: { email: datos.emailPagador } } : {}),
  };

  const respuesta = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(cuerpo),
    cache: "no-store",
  });
  const json = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !json?.id) {
    throw new Error(`MP /checkout/preferences respondió ${respuesta.status}: ${json?.message ?? "sin detalle"}`);
  }
  // Con credenciales de prueba se paga en init_point con un comprador de
  // prueba; sandbox_init_point queda como respaldo. (A confirmar al probar.)
  const linkPago = json.init_point ?? json.sandbox_init_point;
  if (!linkPago) throw new Error("MP no devolvió link de pago");
  return { id: String(json.id), linkPago };
}

export type PagoMp = {
  id: number | string;
  status: string;
  transaction_amount: number;
  currency_id: string;
  external_reference: string | null;
};

// null = MP no conoce ese pago (por ejemplo, una notificación simulada).
export async function obtenerPago(accessToken: string, pagoId: string): Promise<PagoMp | null> {
  const respuesta = await fetch(`${API}/v1/payments/${encodeURIComponent(pagoId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw new Error(`MP /v1/payments respondió ${respuesta.status}`);
  return (await respuesta.json()) as PagoMp;
}

// ── Firma de webhooks ───────────────────────────────────────────────────
export function firmaWebhookValida(
  xSignature: string,
  xRequestId: string | null,
  dataId: string | null,
): boolean {
  const partes = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  // Los valores que faltan se sacan del template (doc oficial).
  let manifiesto = "";
  if (dataId) manifiesto += `id:${/[A-Z]/.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (xRequestId) manifiesto += `request-id:${xRequestId};`;
  manifiesto += `ts:${ts};`;

  const esperado = createHmac("sha256", variable("MP_WEBHOOK_SECRET")).update(manifiesto).digest("hex");
  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(v1, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── ¿Esta reserva se cobra online? ──────────────────────────────────────
// Se cobra solo si el negocio eligió seña o total, el servicio da un monto
// (ver montoACobrar) y el negocio tiene Mercado Pago conectado. Si no, la
// reserva se confirma directo, como antes de la etapa 2.
export async function cobroOnline(
  negocioId: string,
  servicioId: string,
): Promise<{ monto: number; esSena: boolean; servicioNombre: string; negocioNombre: string } | null> {
  const admin = crearClientePublico();
  const [{ data: negocio }, { data: servicio }, { data: cuenta }] = await Promise.all([
    admin.from("negocios").select("nombre, cobro_modo, sena_tipo, sena_valor").eq("id", negocioId).maybeSingle(),
    admin.from("servicios").select("nombre, precio").eq("id", servicioId).eq("negocio_id", negocioId).maybeSingle(),
    admin.from("mp_cuentas").select("negocio_id").eq("negocio_id", negocioId).maybeSingle(),
  ]);
  if (!negocio || !servicio || !cuenta) return null;

  const monto = montoACobrar(negocio as ConfigCobro, servicio.precio);
  if (!monto) return null;
  return {
    monto,
    esSena: negocio.cobro_modo === "sena",
    servicioNombre: servicio.nombre,
    negocioNombre: negocio.nombre,
  };
}
