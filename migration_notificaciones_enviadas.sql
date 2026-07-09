BEGIN;

-- Registro local de cada notificación aceptada por el Grupo 6 (HTTP 202), para
-- poder consultar su estado de entrega despues via /tracking/:notificationId.
-- Ver src/integrations/notificaciones/entities/notificacion-enviada.entity.ts
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
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_enviadas_visita_id ON notificaciones_enviadas(visita_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_enviadas_paciente_id ON notificaciones_enviadas(paciente_id);

COMMIT;
