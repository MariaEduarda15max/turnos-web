-- turnos-web · Migración inicial
-- Reusa el modelo de turnos-bot, sumando: multi-negocio (negocio_id en
-- todas las tablas), Supabase Auth para negocio y cliente, y acceso por
-- token para clientes que reservan sin cuenta.

create extension if not exists "btree_gist";
create extension if not exists "pgcrypto";

create type estado_turno as enum ('confirmado', 'cancelado', 'completado');
create type estado_pedido as enum ('pendiente', 'listo', 'entregado');

-- ── Negocios ─────────────────────────────────────────────────────────────
create table negocios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email_admin text not null,
  auth_user_id uuid unique references auth.users(id),
  creado_en timestamptz not null default now()
);

-- ── Clientes ─────────────────────────────────────────────────────────────
-- Un mismo email/teléfono puede existir como cliente de varios negocios
-- distintos — son filas separadas, cada una atada a su negocio_id.
-- auth_user_id es null hasta que el cliente crea cuenta (o para siempre,
-- si reserva siempre como invitado).
create table clientes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  auth_user_id uuid references auth.users(id),
  nombre text not null,
  telefono text,
  email text,
  creado_en timestamptz not null default now()
);

create index idx_clientes_negocio on clientes (negocio_id);
create index idx_clientes_auth_user on clientes (auth_user_id);
-- Para la fusión de cuentas (adoptar_turnos_invitado): buscar rápido por
-- email dentro de un negocio.
create index idx_clientes_email_negocio on clientes (negocio_id, email);

-- ── Servicios ────────────────────────────────────────────────────────────
create table servicios (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre text not null,
  duracion_min int not null check (duracion_min > 0),
  activo boolean not null default true
);

create index idx_servicios_negocio on servicios (negocio_id);

-- ── Disponibilidad ───────────────────────────────────────────────────────
create table disponibilidad (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  dia_semana int not null check (dia_semana between 0 and 6),
  hora_desde time not null,
  hora_hasta time not null,
  check (hora_desde < hora_hasta)
);

create index idx_disponibilidad_negocio on disponibilidad (negocio_id);

-- ── Bloqueos ─────────────────────────────────────────────────────────────
create table bloqueos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  fecha date not null,
  hora_desde time not null,
  hora_hasta time not null,
  motivo text,
  check (hora_desde < hora_hasta)
);

create index idx_bloqueos_negocio on bloqueos (negocio_id);

-- ── Turnos ───────────────────────────────────────────────────────────────
-- rango_turno: misma función IMMUTABLE que en turnos-bot (ver su SPEC.md
-- sección 4.5) — Postgres exige que toda expresión usada en un índice
-- esté marcada immutable explícitamente.
create function rango_turno(inicio timestamptz, duracion_min int)
returns tstzrange
language sql
immutable
as $$
  select tstzrange(inicio, inicio + (duracion_min || ' minutes')::interval)
$$;

create table turnos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  servicio_id uuid not null references servicios(id),
  inicio timestamptz not null,
  duracion_min int not null,
  estado estado_turno not null default 'confirmado',
  recordatorio_enviado boolean not null default false,
  -- Acceso por link para clientes sin cuenta: quien tenga este token puede
  -- ver/cancelar/reprogramar ESTE turno puntual, vía Edge Function (no
  -- vía RLS directo — ver guía de estudio, "el caso difícil").
  token_acceso uuid not null default gen_random_uuid(),
  -- Anti doble-reserva, ahora POR NEGOCIO: sin negocio_id acá, dos negocios
  -- distintos nunca podrían tener un turno a la misma hora exacta, lo cual
  -- sería un bug — son calendarios independientes.
  exclude using gist (
    negocio_id with =,
    rango_turno(inicio, duracion_min) with &&
  ) where (estado = 'confirmado')
);

create index idx_turnos_negocio on turnos (negocio_id);
create index idx_turnos_cliente on turnos (cliente_id);
create index idx_turnos_inicio on turnos (inicio);
create unique index idx_turnos_token on turnos (token_acceso);

-- ── Pedidos ──────────────────────────────────────────────────────────────
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  descripcion text not null,
  estado estado_pedido not null default 'pendiente',
  avisado_en timestamptz
);

create index idx_pedidos_negocio on pedidos (negocio_id);

-- ── Identidad: qué negocio es el usuario autenticado ────────────────────
-- security definer: un negocio normal no tiene permiso para leer toda la
-- tabla `negocios` directamente (rompería el aislamiento) — esta función
-- corre con permisos elevados solo para devolver ESTE único resultado.
create function negocio_actual()
returns uuid
language sql
security definer
stable
as $$
  select id from negocios where auth_user_id = auth.uid()
$$;

-- ── Fusión de cuentas: turnos de invitado → cuenta nueva ────────────────
create function adoptar_turnos_invitado(email_cliente text)
returns void
language sql
security definer
as $$
  update clientes
  set auth_user_id = auth.uid()
  where negocio_id = negocio_actual()
    and email = email_cliente
    and auth_user_id is null;
$$;

-- ── Row Level Security ───────────────────────────────────────────────────
alter table negocios enable row level security;
alter table clientes enable row level security;
alter table servicios enable row level security;
alter table disponibilidad enable row level security;
alter table bloqueos enable row level security;
alter table turnos enable row level security;
alter table pedidos enable row level security;

-- Negocios: cada dueño solo ve/edita su propia fila.
create policy "negocio ve y edita su propio registro"
on negocios for all
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

-- Servicios, disponibilidad, bloqueos: el negocio dueño tiene control total.
create policy "negocio administra sus servicios"
on servicios for all
using (negocio_id = negocio_actual())
with check (negocio_id = negocio_actual());

create policy "negocio administra su disponibilidad"
on disponibilidad for all
using (negocio_id = negocio_actual())
with check (negocio_id = negocio_actual());

create policy "negocio administra sus bloqueos"
on bloqueos for all
using (negocio_id = negocio_actual())
with check (negocio_id = negocio_actual());

-- Clientes: el negocio ve todos los suyos; un cliente con cuenta ve/edita
-- solo su propia fila (por eso "for all" con dos condiciones por OR).
create policy "negocio ve sus clientes"
on clientes for all
using (negocio_id = negocio_actual())
with check (negocio_id = negocio_actual());

create policy "cliente con cuenta ve su propio registro"
on clientes for select
using (auth_user_id = auth.uid());

-- Turnos: el negocio ve todos los suyos; un cliente con cuenta ve solo los
-- turnos ligados a SU fila de cliente (no a otras filas de cliente, aunque
-- compartan negocio).
create policy "negocio ve y administra sus turnos"
on turnos for all
using (negocio_id = negocio_actual())
with check (negocio_id = negocio_actual());

create policy "cliente con cuenta ve sus propios turnos"
on turnos for select
using (
  cliente_id in (select id from clientes where auth_user_id = auth.uid())
);

-- Pedidos: mismo patrón que turnos.
create policy "negocio ve y administra sus pedidos"
on pedidos for all
using (negocio_id = negocio_actual())
with check (negocio_id = negocio_actual());

create policy "cliente con cuenta ve sus propios pedidos"
on pedidos for select
using (
  cliente_id in (select id from clientes where auth_user_id = auth.uid())
);

-- Nota: el acceso de CLIENTE SIN CUENTA (por token_acceso) no pasa por
-- estas políticas — no hay auth.uid() para un invitado. Ese camino se
-- resuelve en una Edge Function con la secret key (bypasea RLS por
-- diseño) que valida el token a mano. Ver guía de estudio.