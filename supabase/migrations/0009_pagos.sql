-- turnos-web · Pagos (etapa 1: registro manual)
--
-- Un pago pertenece a UN turno o a UN pedido. Por ahora los carga el
-- negocio a mano (efectivo, transferencia, etc.). La tabla ya tiene lo
-- que va a necesitar el cobro online con Mercado Pago (etapa 2):
-- origen 'online', estado 'pendiente'/'devuelto' y la referencia externa.
-- Se admiten pagos parciales: lo pagado es la suma de los pagos aprobados.

-- Precio de referencia (opcional) para calcular "lo que falta".
alter table servicios add column if not exists precio numeric(12,2) check (precio >= 0);
alter table pedidos   add column if not exists monto  numeric(12,2) check (monto  >= 0);

do $$ begin
  create type metodo_pago as enum ('efectivo', 'transferencia', 'mercadopago', 'otro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_pago as enum ('aprobado', 'pendiente', 'devuelto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type origen_pago as enum ('manual', 'online');
exception when duplicate_object then null; end $$;

create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  turno_id uuid references turnos(id) on delete cascade,
  pedido_id uuid references pedidos(id) on delete cascade,
  monto numeric(12,2) not null check (monto > 0),
  -- Solo pesos por ahora; el check deja lista la puerta para dólares.
  moneda text not null default 'UYU' check (moneda in ('UYU', 'USD')),
  metodo metodo_pago not null,
  estado estado_pago not null default 'aprobado',
  origen origen_pago not null default 'manual',
  -- Id del pago en Mercado Pago (etapa 2). Único para no registrar dos
  -- veces el mismo aviso.
  referencia_externa text unique,
  nota text,
  creado_en timestamptz not null default now(),
  -- Exactamente uno: o es de un turno, o es de un pedido.
  constraint pago_de_turno_o_pedido check (num_nonnulls(turno_id, pedido_id) = 1)
);

create index if not exists idx_pagos_negocio on pagos (negocio_id);
create index if not exists idx_pagos_turno on pagos (turno_id);
create index if not exists idx_pagos_pedido on pagos (pedido_id);

-- El turno/pedido tiene que ser del MISMO negocio que el pago. RLS ya
-- obliga a que negocio_id sea el tuyo, pero no que el turno lo sea.
create or replace function pagos_valida_negocio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.turno_id is not null
     and not exists (select 1 from turnos where id = new.turno_id and negocio_id = new.negocio_id) then
    raise exception 'El turno no pertenece a este negocio';
  end if;
  if new.pedido_id is not null
     and not exists (select 1 from pedidos where id = new.pedido_id and negocio_id = new.negocio_id) then
    raise exception 'El pedido no pertenece a este negocio';
  end if;
  return new;
end;
$$;

drop trigger if exists pagos_valida_negocio on pagos;
create trigger pagos_valida_negocio
before insert or update on pagos
for each row execute function pagos_valida_negocio();

alter table pagos enable row level security;

drop policy if exists "negocio administra sus pagos" on pagos;
create policy "negocio administra sus pagos"
on pagos for all
using (negocio_id = negocio_actual())
with check (negocio_id = negocio_actual());

-- El cliente con cuenta ve (solo lectura) los pagos de SUS turnos y pedidos.
drop policy if exists "cliente ve pagos de sus turnos y pedidos" on pagos;
create policy "cliente ve pagos de sus turnos y pedidos"
on pagos for select
using (
  turno_id in (
    select t.id from turnos t join clientes c on c.id = t.cliente_id
    where c.auth_user_id = auth.uid()
  )
  or pedido_id in (
    select p.id from pedidos p join clientes c on c.id = p.cliente_id
    where c.auth_user_id = auth.uid()
  )
);
