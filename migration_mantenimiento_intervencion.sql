-- =====================================================================
-- Migración: Paso 14 (reemplazo de componentes / cierre de orden de trabajo)
-- =====================================================================
-- Agrega a inspecciones_mantenimiento el registro de la intervención: cuándo se
-- instalaron los componentes y las notas. Al setearse, el estado pasa a
-- 'FINALIZADA' (orden de trabajo finalizada).
--
-- Idempotente (IF NOT EXISTS): seguro de re-correr.
-- =====================================================================

ALTER TABLE inspecciones_mantenimiento
    ADD COLUMN IF NOT EXISTS intervencion_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS intervencion_notas TEXT;
