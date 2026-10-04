import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

// Destino del link del email de confirmación. Abre la sesión y termina el
// alta (crea la fila de negocio o de cliente) — recién acá, porque es el
// primer momento en que el email está verificado y hay sesión.
//
// Acepta los dos formatos que puede mandar Supabase:
// - `?code=...` (PKCE, el template por defecto con {{ .ConfirmationURL }}).
//   Solo funciona en el MISMO navegador donde se hizo el registro.
// - `?token_hash=...&type=email` (si se cambia el template del email;
//   funciona desde cualquier navegador/dispositivo).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Solo rutas internas: evita usar este endpoint como redirección abierta
  // hacia otro dominio (?next=https://sitio-malicioso.com).
  const next = searchParams.get("next") ?? "/";
  const destino = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const matchNegocio = destino.match(/^\/r\/([0-9a-f-]{36})(\/|$)/i);
  const negocioId = matchNegocio?.[1];
  const loginPorDefecto = negocioId ? `/r/${negocioId}/cuenta/login` : "/login";

  const supabase = await crearClienteServidor();

  let error: unknown = null;
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else {
    error = new Error("Link de confirmación incompleto");
  }

  if (error) {
    // El email puede haber quedado confirmado igual (p. ej. link abierto en
    // otro navegador): el login termina el alta en ese caso.
    return NextResponse.redirect(
      new URL(`${loginPorDefecto}?confirmacion=revisar`, origin),
    );
  }

  const { error: errorAlta } = negocioId
    ? await supabase.rpc("vincular_cliente", { negocio_id_param: negocioId })
    : await supabase.rpc("completar_alta_negocio");

  if (errorAlta) {
    return NextResponse.redirect(new URL(`${loginPorDefecto}?confirmacion=error`, origin));
  }

  return NextResponse.redirect(new URL(destino, origin));
}
