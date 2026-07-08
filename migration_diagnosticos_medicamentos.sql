BEGIN;

-- Diagnósticos: múltiples por visita (a diferencia de fichas_clinicas, que solo
-- admite una ficha por visita). Se registran desde la pestaña "Historial" de la
-- app móvil, no desde "Consulta".
CREATE TABLE IF NOT EXISTS diagnosticos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visita_id UUID NOT NULL,
    descripcion TEXT NOT NULL,
    creado_por_usuario_id UUID,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP,
    CONSTRAINT fk_diagnostico_visita FOREIGN KEY (visita_id) REFERENCES visitas(id)
);

-- Medicamentos: lista editable (agregar/quitar) asociada a la visita, con
-- soft-delete para "quitar" un medicamento sin perder el registro histórico.
CREATE TABLE IF NOT EXISTS medicamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visita_id UUID NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    indicaciones VARCHAR(300),
    creado_por_usuario_id UUID,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP,
    CONSTRAINT fk_medicamento_visita FOREIGN KEY (visita_id) REFERENCES visitas(id)
);

CREATE INDEX IF NOT EXISTS idx_diagnosticos_visita_id ON diagnosticos(visita_id);
CREATE INDEX IF NOT EXISTS idx_medicamentos_visita_id ON medicamentos(visita_id);

COMMIT;
