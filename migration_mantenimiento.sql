-- =====================================================================
-- Migración: tabla inspecciones_mantenimiento (integración con Proyecto 3)
-- =====================================================================
-- Guarda el informe técnico de cada inspección de mantenimiento preventivo
-- (Paso 9) y el resultado del pedido automático de repuestos enviado al
-- Proyecto 3 - Gestión de Pedidos (Paso 10, webhook /api/webhooks/maintenance).
--
-- Idempotente (IF NOT EXISTS): seguro de re-correr.
-- =====================================================================

CREATE TABLE IF NOT EXISTS inspecciones_mantenimiento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL,
    visita_id UUID,
    equipo VARCHAR(150) NOT NULL,
    diagnostico TEXT,
    prioridad VARCHAR(20) NOT NULL DEFAULT 'media',
    repuestos JSONB NOT NULL DEFAULT '[]',
    estado VARCHAR(30) NOT NULL DEFAULT 'REGISTRADA',
    pedido_externo_id VARCHAR(150),
    pedido_estado_externo VARCHAR(60),
    pedido_error TEXT,
    creado_por_usuario_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inspecciones_mantenimiento_paciente_id ON inspecciones_mantenimiento(paciente_id);
CREATE INDEX IF NOT EXISTS idx_inspecciones_mantenimiento_estado ON inspecciones_mantenimiento(estado);
