import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearPkce, crearState, urlAutorizacion } from "@/lib/mp";

export const dynamic = "force-dynamic";

// "Conectar Mercado Pago": arma el PKCE, guarda state + verifier en una
// cookie httpOnly (10 min, lo mismo que dura el code) y manda al negocio a
// autorizar en MP. MP vuelve a /api/mp/oauth/callback.
export async function GET(request: NextRequest) {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  // RLS: solo devuelve el negocio de esta sesión.
  const { data: negocio } = await supabase.from("negocios").select("id").maybeSingle();
  if (!negocio) return NextResponse.redirect(new URL("/dashboard", request.url));

  const { verifier, challenge } = crearPkce();
  const state = crearState();

  const respuesta = NextResponse.redirect(urlAutorizacion(state, challenge));
  respuesta.cookies.set("mp_oauth", `${state}.${verifier}`, {
    httpOnly: true,
    secure: true,
    // lax: la vuelta desde MP es una navegación GET normal, así que la
    // cookie viaja; un POST de otro sitio no la llevaría.
    sameSite: "lax",
    path: "/api/mp/oauth",
    maxAge: 600,
  });
  return respuesta;
}
