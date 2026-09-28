import "server-only";
import { createClient } from "@supabase/supabase-js";

// SOLO para usar dentro de Server Components / Server Actions de la
// página pública de reservar turno (ej. /r/[negocioId]). Usa la secret
// key — bypasea RLS por diseño, igual que la función `telegram-webhook`
// de turnos-bot.
//
// Por qué NO usamos RLS pública para esto: la página necesita leer
// `turnos` y `bloqueos` para calcular horarios libres, y esas tablas
// tienen datos de clientes reales — abrir una política de RLS amplia
// para "cualquiera" expondría eso a quien sepa consultarlo directo, no
// solo a través de esta página. Acá, en cambio, el código decide
// explícitamente qué exponer (horarios calculados), nunca las filas
// crudas de turnos.
//
// "server-only" hace que Next tire un error de build si este archivo
// se importa por accidente desde un Client Component — es la red de
// seguridad para no filtrar la secret key al navegador.
//
// A diferencia de turnos-bot (donde Supabase inyecta SUPABASE_SECRET_KEYS
// automáticamente dentro de sus propias Edge Functions), acá estamos
// en un proyecto Next.js corriendo afuera de ese runtime — la secret key
// hay que cargarla a mano en .env.local como SUPABASE_SECRET_KEY (sin
// el prefijo NEXT_PUBLIC_, para que nunca llegue al navegador).
export function crearClientePublico() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}