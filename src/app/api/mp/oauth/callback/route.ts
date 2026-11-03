import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { canjearCodigo, CuentaYaConectadaError, guardarCuenta } from "@/lib/mp";

export const dynamic = "force-dynamic";

// Vuelta del OAuth. Chequea que el state sea el que generamos (si no,
// alguien podría colarle SU cuenta de MP a este negocio), canjea el code
// con el verifier de PKCE y guarda los tokens cifrados.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const volver = (resultado: string) => {
    const r = NextResponse.redirect(new URL(`/dashboard/cobros?mp=${resultado}`, request.url));
    r.cookies.set("mp_oauth", "", { path: "/api/mp/oauth", maxAge: 0 });
    return r;
  };

  // El negocio tocó "Cancelar" en MP, o MP devolvió un error.
  if (url.searchParams.get("error")) return volver("cancelado");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const [stateGuardado, verifier] = (request.cookies.get("mp_oauth")?.value ?? "").split(".");
  if (!code || !state || !stateGuardado || !verifier || state !== stateGuardado) {
    return volver("vencido");
  }

  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  const { data: negocio } = await supabase.from("negocios").select("id").maybeSingle();
  if (!negocio) return NextResponse.redirect(new URL("/dashboard", request.url));

  try {
    const tokens = await canjearCodigo(code, verifier);
    await guardarCuenta(negocio.id, tokens);
    return volver("conectado");
  } catch (e) {
    if (e instanceof CuentaYaConectadaError) return volver("cuenta_en_uso");
    console.error("[mp oauth]", e instanceof Error ? e.message : e);
    return volver("error");
  }
}
