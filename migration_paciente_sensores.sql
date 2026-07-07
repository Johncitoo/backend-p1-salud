BEGIN;

-- Tabla del módulo IoT (integración Grupo 8): vincula un sensor físico/simulado
-- (assetId + sensorId, únicos en conjunto) al paciente que lo está usando en
-- un momento dado. Ya existía la entidad en código (PacienteSensor) pero
-- faltaba la migración para crear la tabla en la base de datos real.
CREATE TABLE IF NOT EXISTS paciente_sensores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL,
    asset_id VARCHAR(150) NOT NULL,
    sensor_id VARCHAR(150) NOT NULL,
    sensor_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP,
    CONSTRAINT fk_paciente_sensor_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
    CONSTRAINT uq_paciente_sensor_asset_sensor UNIQUE (asset_id, sensor_id)
);

CREATE INDEX IF NOT EXISTS idx_paciente_sensores_paciente_id ON paciente_sensores(paciente_id);

COMMIT;
