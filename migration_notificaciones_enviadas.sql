-- =====================================================================
-- Migración: tabla notificaciones_enviadas (tracking de Grupo 6)
-- =====================================================================
-- La entidad NotificacionEnviada (integración con Grupo 6) guarda un registro
-- local por cada notificación aceptada, para poder consultar su estado de
-- entrega vía /tracking/:notificationId. La tabla existe en dev pero faltaba en
-- producción (y en init.sql) → al enviar una notificación el insert fallaba con:
--   relation "notificaciones_enviadas" does not exist
-- Nota: el envío a Grupo 6 SÍ ocurre; lo único que fallaba era guardar el tracking.
--
-- Idempotente (IF NOT EXISTS): seguro de re-correr.
-- =====================================================================

CREATE TABLE IF NOT EXISTS notificaciones_enviadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento VARCHAR(60) NOT NULL,
    visita_id UUID,
    paciente_id UUID,
    destinatario_email VARCHAR(255),
    destinatario_telefono VARCHAR(30),
    notification_id VARCHAR(100) NOT NULL,
    job_id VARCHAR(100),
    estado VARCHAR(30) NOT NULL DEFAULT 'enviado',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_enviadas_visita_id ON notificaciones_enviadas(visita_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_enviadas_paciente_id ON notificaciones_enviadas(paciente_id);
