-- =====================================================================
-- Migración: columna 'version' en fichas_clinicas (optimistic locking)
-- =====================================================================
-- La entidad FichaClinica usa @VersionColumn() de TypeORM, que espera una
-- columna 'version' en la tabla. init.sql ya la incluye para bases nuevas,
-- pero las bases creadas antes de que se agregara (ej. producción) no la
-- tienen, y TypeORM falla con: column fc.version does not exist (42703).
--
-- Este ALTER la agrega. Es idempotente (IF NOT EXISTS): seguro de re-correr.
-- =====================================================================

ALTER TABLE fichas_clinicas
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
