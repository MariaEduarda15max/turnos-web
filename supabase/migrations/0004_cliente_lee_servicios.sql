-- turnos-web · Correcciones sobre 0003
--
-- 1) BUG: en /mis-turnos, el join turnos → servicios(nombre) volvía null
--    para un cliente con cuenta. La única política de `servicios` era
--    "negocio administra sus servicios" (negocio_actual()), que no aplica
--    a clientes → RLS filtraba la fila y la página rompía.
--    Solución acotada: el cliente puede leer SOLO los servicios de sus
--    propios turnos (no el catálogo entero de cualquier negocio).
create policy "cliente con cuenta ve servicios de sus turnos"
on servicios for select
using (
  id in (
    select t.servicio_id
    from turnos t
    join clientes c on c.id = t.cliente_id
    where c.auth_user_id = auth.uid()
  )
);

-- 2) La 0003 hizo `create or replace` con OTRA firma (uuid en vez de
--    text): Postgres no reemplaza, crea una sobrecarga. La versión vieja,
--    que recibe el email como parámetro, seguía existiendo y era
--    ejecutable por cualquier usuario autenticado. Se elimina.
drop function if exists adoptar_turnos_invitado(text);

-- 3) La política de INSERT de 0003 no ataba el email de la fila al email
--    de la sesión: un cliente podía registrarse con un email cualquiera.
drop policy if exists "cliente crea su propio registro" on clientes;
create policy "cliente crea su propio registro"
on clientes for insert
with check (
  auth_user_id = auth.uid()
  and email = auth.email()
);
