-- =====================================================================
-- Migración: versionado del informe técnico (Paso 19 del UAT)
-- =====================================================================
-- Agrega a inspecciones_mantenimiento el número de versión del informe y el
-- historial de versiones anteriores, para poder corregir el documento y emitir
-- una nueva versión conservando la traza de la original.
--
-- Idempotente (IF NOT EXISTS): seguro de re-correr.
-- =====================================================================

ALTER TABLE inspecciones_mantenimiento
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE inspecciones_mantenimiento
    ADD COLUMN IF NOT EXISTS historial_versiones JSONB NOT NULL DEFAULT '[]';
