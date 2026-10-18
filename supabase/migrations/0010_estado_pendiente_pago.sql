-- turnos-web · Pagos etapa 2 (1/2): estado "pendiente de pago"
--
-- Va SOLA en su migración: Postgres no deja USAR un valor de enum nuevo
-- en la misma transacción en la que se agrega ("unsafe use of new value").
-- 0011 lo usa (en la exclusion constraint), así que primero tiene que
-- quedar commiteado este. Si se aplica desde el SQL Editor: correr este
-- archivo, y recién después 0011, en dos ejecuciones separadas.
alter type estado_turno add value if not exists 'pendiente_pago';
