import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Para usar dentro de Server Components, Server Actions y Route Handlers.
// Lee/escribe la sesión del usuario a través de las cookies del request —
// esto es lo que le permite a Next.js saber "quién está logueado" en el
// servidor, sin que el navegador tenga que mandar nada aparte.
export async function crearClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Un Server Component no puede escribir cookies — es
            // esperable acá, el middleware es quien refresca la sesión.
          }
        },
      },
    },
  );
}
