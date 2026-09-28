-- turnos-web · Disponibilidad sin franjas superpuestas
-- Sin esto, un negocio podría cargar "lunes 9–13" y "lunes 12–15": el
-- cálculo de slots libres generaría turnos duplicados en 12–13. Mismo
-- enfoque que el anti doble-reserva de turnos: una exclusion constraint,
-- así la regla la garantiza Postgres y no depende de que el front valide.

-- `time` no tiene tipo rango propio en Postgres, así que se "ancla" cada
-- hora a una fecha fija cualquiera y se arma un tsrange. Tiene que ser
-- IMMUTABLE por el mismo motivo que rango_turno (se usa en un índice).
-- tsrange es [desde, hasta): 9–13 y 13–17 NO se superponen (son contiguas).
create function rango_franja(hora_desde time, hora_hasta time)
returns tsrange
language sql
immutable
as $$
  select tsrange(date '2000-01-01' + hora_desde, date '2000-01-01' + hora_hasta)
$$;

alter table disponibilidad
  add constraint disponibilidad_sin_solapes
  exclude using gist (
    negocio_id with =,
    dia_semana with =,
    rango_franja(hora_desde, hora_hasta) with &&
  );
