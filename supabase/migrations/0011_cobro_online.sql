-- turnos-web · Pagos etapa 2 (2/2): cobro online con Mercado Pago (marketplace)
--
-- Flujo: el cliente reserva → si el negocio cobra online, el turno nace
-- 'pendiente_pago' con expira_en = now() + 15 min y bloquea el horario →
-- paga en Checkout Pro → el webhook llama a registrar_pago_online(), que
-- inserta el pago y confirma el turno. Si nadie paga, el hold vence y el
-- horario se libera (limpieza perezosa, ver liberar_turnos_vencidos()).
--
-- Comisión de la plataforma (marketplace_fee): 0 por ahora; el ingreso
-- viene por suscripción (etapa 3). No hace falta columna para eso todavía.

-- ── 1. Configuración de cobro por negocio ───────────────────────────────
alter table negocios
  add column if not exists cobro_modo text not null default 'no_cobrar'
    check (cobro_modo in ('no_cobrar', 'sena', 'total')),
  add column if not exists sena_tipo text
    check (sena_tipo in ('porcentaje', 'monto')),
  add column if not exists sena_valor numeric(12,2)
    check (sena_valor > 0);

-- Si cobra seña, tiene que decir cómo y cuánto (y un % no pasa de 100).
alter table negocios drop constraint if exists negocios_sena_completa;
alter table negocios add constraint negocios_sena_completa check (
  cobro_modo <> 'sena'
  or (sena_tipo is not null and sena_valor is not null
      and (sena_tipo <> 'porcentaje' or sena_valor <= 100))
);

-- ── 2. Turno retenido mientras se paga ──────────────────────────────────
-- expira_en: solo tiene valor en turnos que nacieron 'pendiente_pago'.
--   pendiente_pago + expira_en futuro  → hold vigente, bloquea el horario
--   cancelado      + expira_en no nulo → hold vencido (nadie pagó a tiempo)
--   confirmado                          → expira_en vuelve a null al pagar
alter table turnos
  add column if not exists expira_en timestamptz,
  -- Para volver a mostrar "Pagar" si el cliente cerró la pestaña.
  add column if not exists mp_preferencia_id text,
  add column if not exists link_pago text;

-- La exclusion constraint de 0001 no tiene nombre explícito: la busco y
-- la reemplazo por una con nombre que también cubra los holds. No puede
-- usar now() (no es immutable), por eso los holds vencidos se limpian
-- con liberar_turnos_vencidos() antes de reservar y de calcular slots.
do $$
declare
  v_nombre text;
begin
  for v_nombre in
    select conname from pg_constraint
    where conrelid = 'public.turnos'::regclass and contype = 'x'
  loop
    execute format('alter table turnos drop constraint %I', v_nombre);
  end loop;
end $$;

alter table turnos add constraint turnos_sin_solapes
  exclude using gist (
    negocio_id with =,
    rango_turno(inicio, duracion_min) with &&
  ) where (estado in ('confirmado', 'pendiente_pago'));

create index if not exists idx_turnos_pendientes
  on turnos (negocio_id, expira_en) where estado = 'pendiente_pago';

-- Pasa a 'cancelado' los holds vencidos de un negocio. La llama el
-- servidor (key secreta) antes de reservar y de calcular horarios libres.
create or replace function liberar_turnos_vencidos(negocio_id_param uuid)
returns integer
language sql
set search_path = public
as $$
  with liberados as (
    update turnos set estado = 'cancelado'
    where negocio_id = negocio_id_param
      and estado = 'pendiente_pago'
      and expira_en < now()
    returning 1
  )
  select count(*)::int from liberados;
$$;

revoke execute on function liberar_turnos_vencidos(uuid) from public, anon, authenticated;

-- ── 3. Cuenta de Mercado Pago conectada (OAuth) ─────────────────────────
-- Los tokens van CIFRADOS por la app (AES-256-GCM, clave en Vercel) — la
-- base nunca ve el token en claro. RLS activado y SIN políticas: ni anon
-- ni authenticated pueden leer esta tabla; solo el servidor con la key
-- secreta. El panel consulta el estado con mp_estado_conexion().
create table if not exists mp_cuentas (
  negocio_id uuid primary key references negocios(id) on delete cascade,
  mp_user_id text not null unique,
  access_token_cifrado text not null,
  refresh_token_cifrado text not null,
  public_key text,
  -- Credenciales de prueba (test_token = true) o reales.
  modo_prueba boolean not null default true,
  token_expira_en timestamptz not null,
  conectado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table mp_cuentas enable row level security;
revoke all on mp_cuentas from anon, authenticated;

-- Lo único que el panel necesita saber, sin tocar los tokens.
create or replace function mp_estado_conexion()
returns table (conectado boolean, mp_user_id text, modo_prueba boolean, token_expira_en timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select true, c.mp_user_id, c.modo_prueba, c.token_expira_en
  from mp_cuentas c
  where c.negocio_id = negocio_actual();
$$;

revoke execute on function mp_estado_conexion() from public, anon;
grant execute on function mp_estado_conexion() to authenticated;

-- ── 4. Pagos online ─────────────────────────────────────────────────────
-- requiere_revision: el pago entró pero algo no cierra (ej. pagó después
-- de que venció el hold y alguien más tomó el horario) → devolución a
-- mano por ahora (etapa 2, punto 7).
alter table pagos add column if not exists requiere_revision boolean not null default false;

-- Lo llama SOLO el webhook (key secreta), DESPUÉS de validar la firma y
-- de consultar el pago en GET /v1/payments/{id} con el token del negocio.
-- Idempotente: MP reintenta avisos, referencia_externa es única.
--   estado_mp: approved | pending | in_process | rejected | cancelled |
--              refunded | charged_back
create or replace function registrar_pago_online(
  negocio_id_param uuid,
  turno_id_param uuid,
  referencia_param text,
  monto_param numeric,
  moneda_param text,
  estado_mp text
)
returns text  -- 'ignorado' | 'registrado' | 'confirmado' | 'revision'
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado estado_pago;
  v_turno turnos%rowtype;
begin
  v_estado := case
    when estado_mp = 'approved' then 'aprobado'
    when estado_mp in ('pending', 'in_process') then 'pendiente'
    when estado_mp in ('refunded', 'charged_back') then 'devuelto'
    else null
  end::estado_pago;

  -- rejected/cancelled: no hay plata en juego. Si había una fila
  -- 'pendiente' de este mismo pago, se borra.
  if v_estado is null then
    delete from pagos where referencia_externa = referencia_param and estado = 'pendiente';
    return 'ignorado';
  end if;

  select * into v_turno from turnos
  where id = turno_id_param and negocio_id = negocio_id_param
  for update;

  if not found then
    raise exception 'Turno % no encontrado para el negocio %', turno_id_param, negocio_id_param;
  end if;

  insert into pagos (negocio_id, turno_id, monto, moneda, metodo, estado, origen, referencia_externa)
  values (negocio_id_param, turno_id_param, monto_param, moneda_param, 'mercadopago', v_estado, 'online', referencia_param)
  on conflict (referencia_externa) do update
    set estado = excluded.estado, monto = excluded.monto;

  if v_estado <> 'aprobado' then
    return 'registrado';
  end if;

  -- Confirmar el turno si está en hold, o si el hold venció (cancelado
  -- con expira_en) pero el horario sigue libre.
  if v_turno.estado = 'pendiente_pago'
     or (v_turno.estado = 'cancelado' and v_turno.expira_en is not null) then
    begin
      update turnos set estado = 'confirmado', expira_en = null
      where id = turno_id_param;
      return 'confirmado';
    exception when exclusion_violation then
      update pagos set requiere_revision = true,
        nota = 'Pagó después de vencer la reserva y el horario ya estaba tomado: devolver.'
      where referencia_externa = referencia_param;
      return 'revision';
    end;
  end if;

  -- Pagó un turno que ya canceló el cliente o el negocio: devolver.
  if v_turno.estado = 'cancelado' then
    update pagos set requiere_revision = true,
      nota = 'Pagó un turno cancelado: devolver.'
    where referencia_externa = referencia_param;
    return 'revision';
  end if;

  -- Ya confirmado (aviso repetido) u otro estado: queda registrado.
  return 'registrado';
end;
$$;

revoke execute on function registrar_pago_online(uuid, uuid, text, numeric, text, text) from public, anon, authenticated;
