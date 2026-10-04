-- turnos-web · Autoregistro de clientes + corrección de seguridad
--
-- BUG encontrado: adoptar_turnos_invitado() (0001_init.sql) usaba
-- negocio_actual(), que solo devuelve algo si quien llama es DUEÑO de un
-- negocio. Un cliente registrándose nunca lo es — la función no hacía
-- nada, en silencio, sin error visible.
--
-- Corrección: recibe el negocio como parámetro (no sensible, solo scopea
-- la búsqueda), pero el email NUNCA se recibe como parámetro — se toma
-- de auth.email() (la sesión autenticada real). Así, aunque la función
-- bypasea RLS (security definer), solo puede "adoptar" filas que
-- coincidan con el email verificado de quien está logueado en este
-- mismo momento — nunca uno inventado a mano.
create or replace function adoptar_turnos_invitado(negocio_id_param uuid)
returns void
language sql
security definer
as $$
  update clientes
  set auth_user_id = auth.uid()
  where negocio_id = negocio_id_param
    and email = auth.email()
    and auth_user_id is null;
$$;

-- Permite que un cliente recién autenticado cree SU PROPIA fila en
-- `clientes` (con auth_user_id = su propio uid) — sin esto, el registro
-- de cuenta de cliente fallaría con "violates row-level security policy",
-- mismo tipo de error que tuvimos con el registro del negocio.
create policy "cliente crea su propio registro"
on clientes for insert
with check (auth_user_id = auth.uid());