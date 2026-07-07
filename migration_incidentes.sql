BEGIN;

-- 1. Hacer opcional la columna visita_id en alertas
ALTER TABLE alertas ALTER COLUMN visita_id DROP NOT NULL;

-- 2. Crear la tabla para vincular pacientes con sensores IoT
CREATE TABLE IF NOT EXISTS paciente_sensores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL,
    asset_id VARCHAR(150) NOT NULL,
    sensor_id VARCHAR(150) NOT NULL,
    sensor_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_paciente_sensor UNIQUE (asset_id, sensor_id),
    CONSTRAINT fk_paciente_sensor_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
);

COMMIT;
