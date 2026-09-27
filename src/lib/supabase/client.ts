import { createBrowserClient } from "@supabase/ssr";

// Para usar dentro de Client Components ("use client"). Usa la
// publishable key — segura de exponer en el navegador porque RLS es la
// que realmente controla qué puede leer/escribir cada usuario, no el
// secreto de la key.
export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
