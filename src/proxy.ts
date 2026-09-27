import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Las sesiones de Supabase expiran y se renuevan con un token de refresco.
// Sin este proxy, un Server Component podría ver una sesión vencida y
// "desloguear" al usuario de golpe en medio de la navegación. Corre en
// cada request, antes de que llegue a la página.
//
// IMPORTANTE (CVE-2025-29927): esto NO alcanza como única protección de
// rutas — el proxy puede sortearse. Por eso el dashboard también revisa
// la sesión del lado del servidor (ver dashboard/page.tsx) — este es un
// segundo filtro rápido, no el único.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Rutas protegidas: sin sesión, se redirige a /login.
  const rutaProtegida = request.nextUrl.pathname.startsWith("/dashboard");
  if (rutaProtegida && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};