BEGIN;

-- Catálogo de medicamentos: tabla propia, independiente de "medicamentos"
-- (que sigue siendo el registro por-visita). "medicamentos" ahora referencia
-- un ítem de este catálogo + la cantidad de cajas seleccionada, en vez de
-- guardar el nombre como texto libre.
CREATE TABLE IF NOT EXISTS medicamentos_catalogo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(200) NOT NULL UNIQUE,
    presentacion VARCHAR(100),
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

ALTER TABLE medicamentos
    ADD COLUMN IF NOT EXISTS medicamento_catalogo_id UUID REFERENCES medicamentos_catalogo(id),
    ADD COLUMN IF NOT EXISTS cantidad_cajas INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_medicamentos_catalogo_id ON medicamentos(medicamento_catalogo_id);

INSERT INTO medicamentos_catalogo (nombre, presentacion) VALUES
    ('Paracetamol', '500 mg comprimidos'),
    ('Ibuprofeno', '400 mg comprimidos'),
    ('Losartán', '50 mg comprimidos'),
    ('Enalapril', '10 mg comprimidos'),
    ('Metformina', '850 mg comprimidos'),
    ('Omeprazol', '20 mg cápsulas'),
    ('Amoxicilina', '500 mg cápsulas'),
    ('Furosemida', '40 mg comprimidos'),
    ('Atorvastatina', '20 mg comprimidos'),
    ('Insulina NPH', '100 UI/mL frasco'),
    ('Warfarina', '5 mg comprimidos'),
    ('Salbutamol', 'Inhalador 100 mcg')
ON CONFLICT (nombre) DO NOTHING;

COMMIT;
