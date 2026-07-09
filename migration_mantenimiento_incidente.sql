-- =====================================================================
-- Migración: enlace inspección -> incidente (ticket CRM Grupo 7 + Grupo 11)
-- =====================================================================
-- Al crear una inspección de mantenimiento se genera un incidente de salud
-- (origen WEB) que dispara el ticket en CRM (Grupo 7) y en la plataforma de
-- Incidentes (Grupo 11). Guardamos el id de ese incidente para trazabilidad.
--
-- Idempotente (IF NOT EXISTS): seguro de re-correr.
-- =====================================================================

ALTER TABLE inspecciones_mantenimiento
    ADD COLUMN IF NOT EXISTS incidente_id UUID;
