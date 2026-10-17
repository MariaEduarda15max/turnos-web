-- turnos-web · Fechas en pedidos
--
-- La tabla pedidos (0001) no tenía cuándo se creó cada pedido ni cuándo
-- cambió de estado: sin eso no se puede ordenar la lista ni mostrarle al
-- cliente desde cuándo está listo. `avisado_en` sigue reservado para
-- cuando exista el aviso por email (todavía no se usa).
alter table pedidos
  add column if not exists creado_en timestamptz not null default now(),
  add column if not exists listo_en timestamptz,
  add column if not exists entregado_en timestamptz;

create index if not exists idx_pedidos_negocio_creado on pedidos (negocio_id, creado_en desc);
