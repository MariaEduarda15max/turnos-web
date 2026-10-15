-- turnos-web · Poder borrar el usuario de un CLIENTE sin romper nada
--
-- PROBLEMA: clientes.auth_user_id referencia auth.users(id) sin regla
-- ON DELETE (0001). Si la cuenta tiene fila de cliente, borrar el usuario
-- desde el panel de Supabase falla con "Database error deleting user".
--
-- SOLUCIÓN: ON DELETE SET NULL. Al borrar la cuenta, su fila de cliente
-- vuelve a ser "de invitado": los turnos y pedidos se conservan (el
-- negocio no pierde su historial) y siguen accesibles por su token. Si la
-- persona vuelve a registrarse con el mismo email, vincular_cliente()
-- los adopta de nuevo.
--
-- A PROPÓSITO NO se toca negocios.auth_user_id: borrar la cuenta del
-- DUEÑO tiene que seguir bloqueado. Con SET NULL el negocio quedaría
-- huérfano (nadie podría administrarlo) y con CASCADE se borrarían todos
-- sus datos. Dar de baja un negocio es otra decisión, a diseñar aparte.

-- El nombre de la FK lo generó Postgres en 0001 (normalmente
-- clientes_auth_user_id_fkey). Se busca por catálogo para no depender
-- de ese nombre.
do $$
declare
  v_constraint text;
begin
  select con.conname into v_constraint
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
   where con.conrelid = 'public.clientes'::regclass
     and con.contype = 'f'
     and con.confrelid = 'auth.users'::regclass
     and att.attname = 'auth_user_id';

  if v_constraint is not null then
    execute format('alter table public.clientes drop constraint %I', v_constraint);
  end if;
end;
$$;

alter table public.clientes
  add constraint clientes_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id)
  on delete set null;
