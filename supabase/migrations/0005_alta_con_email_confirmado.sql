-- turnos-web · Alta de cuentas con "Confirm email" ACTIVADO
--
-- Con la confirmación de email activa, signUp() NO devuelve sesión: el
-- insert directo en `clientes`/`negocios` desde el navegador corre sin
-- auth.uid() y RLS lo rechaza. Además, adoptar turnos de invitado por
-- auth.email() solo es seguro si ese email está VERIFICADO (si no,
-- cualquiera podría registrarse con un email ajeno y quedarse con sus
-- turnos).
--
-- Solución: la fila de cliente/negocio se crea DESPUÉS de confirmar el
-- email (en /auth/confirm o en el login), vía dos funciones idempotentes
-- que exigen email_confirmed_at. El nombre viaja en user_metadata desde
-- el signUp.

-- ── Cliente: adopta turnos de invitado + crea su fila si hace falta ──────
create or replace function vincular_cliente(negocio_id_param uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.email();
  v_confirmado timestamptz;
  v_nombre text;
  v_cliente uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesión';
  end if;

  select email_confirmed_at, raw_user_meta_data->>'nombre'
    into v_confirmado, v_nombre
    from auth.users where id = v_uid;

  if v_confirmado is null then
    raise exception 'Email sin confirmar';
  end if;

  if not exists (select 1 from negocios where id = negocio_id_param) then
    raise exception 'Negocio inexistente';
  end if;

  -- Adopta las filas de invitado con el MISMO email verificado (sin
  -- importar mayúsculas: la reserva pública guarda lo que se tipeó).
  update clientes
     set auth_user_id = v_uid
   where negocio_id = negocio_id_param
     and lower(email) = lower(v_email)
     and auth_user_id is null;

  select id into v_cliente
    from clientes
   where negocio_id = negocio_id_param and auth_user_id = v_uid
   order by creado_en
   limit 1;

  -- Sin reservas previas: se crea la fila de cliente.
  if v_cliente is null then
    insert into clientes (negocio_id, auth_user_id, nombre, email)
    values (
      negocio_id_param,
      v_uid,
      coalesce(nullif(trim(v_nombre), ''), split_part(v_email, '@', 1)),
      v_email
    )
    returning id into v_cliente;
  end if;

  return v_cliente;
end;
$$;

-- ── Negocio: crea la fila del negocio si todavía no existe ──────────────
-- Solo actúa si la cuenta se registró como negocio (nombre_negocio en la
-- metadata) — así un cliente que entra por /login no crea un negocio.
create or replace function completar_alta_negocio()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_confirmado timestamptz;
  v_nombre text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesión';
  end if;

  select id into v_id from negocios where auth_user_id = v_uid;
  if v_id is not null then
    return v_id;
  end if;

  select email_confirmed_at, raw_user_meta_data->>'nombre_negocio'
    into v_confirmado, v_nombre
    from auth.users where id = v_uid;

  if v_nombre is null or trim(v_nombre) = '' then
    return null;
  end if;

  if v_confirmado is null then
    raise exception 'Email sin confirmar';
  end if;

  insert into negocios (nombre, email_admin, auth_user_id)
  values (trim(v_nombre), auth.email(), v_uid)
  returning id into v_id;

  return v_id;
end;
$$;

-- Solo usuarios logueados pueden llamarlas.
revoke execute on function vincular_cliente(uuid) from public, anon;
grant execute on function vincular_cliente(uuid) to authenticated;
revoke execute on function completar_alta_negocio() from public, anon;
grant execute on function completar_alta_negocio() to authenticated;

-- ── Limpieza de lo que reemplaza esto ───────────────────────────────────
-- La adopción ahora vive en vincular_cliente (con email verificado).
drop function if exists adoptar_turnos_invitado(uuid);
drop function if exists adoptar_turnos_invitado(text);

-- El cliente ya no inserta su fila directo desde el navegador: todo pasa
-- por vincular_cliente. Menos superficie expuesta.
drop policy if exists "cliente crea su propio registro" on clientes;
