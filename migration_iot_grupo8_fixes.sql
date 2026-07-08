-- Migracion: correcciones de esquema para la integracion real con Grupo 8 (IoT)
-- Fecha: 2026-07-07
-- Motivo: al probar la sincronizacion contra la API real de Grupo 8, la BD rechazo
-- los registros por dos restricciones desactualizadas respecto al codigo:
--
-- 1. chk_mediciones_clinicas_origen solo permitia ('FICHA','SENSOR','MANUAL','IMPORTACION'),
--    pero IoTService siempre ha guardado origen='IOT'. Se agrega 'IOT' a la lista permitida.
--
-- 2. alertas.visita_id era NOT NULL, pero las alertas generadas por sensores IoT no nacen
--    de ninguna visita (ocurren entre visitas). La entidad TypeORM Alerta.visitaId ya estaba
--    declarada nullable:true en el codigo desde antes (migration_incidentes.sql, 2026-07-06),
--    pero ese cambio nunca se aplico a la BD ni se llevo a database/init.sql, asi que se
--    perdio. Esta vez se actualiza tambien init.sql para que no se repita.
--
-- Aplicar este mismo script contra produccion (Railway) antes de la prueba conjunta con Grupo 8.

BEGIN;

ALTER TABLE alertas ALTER COLUMN visita_id DROP NOT NULL;

ALTER TABLE mediciones_clinicas DROP CONSTRAINT IF EXISTS chk_mediciones_clinicas_origen;
ALTER TABLE mediciones_clinicas ADD CONSTRAINT chk_mediciones_clinicas_origen
    CHECK (origen IN ('FICHA', 'SENSOR', 'MANUAL', 'IMPORTACION', 'IOT'));

COMMIT;
