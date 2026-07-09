BEGIN;

-- El catalogo se creo con UNIQUE solo en "nombre", lo que impedia agregar el
-- mismo medicamento en distinta presentacion (ej. "Escitalopram 10 mg" y
-- "Escitalopram 20 mg" chocaban como si fueran duplicados). Se reemplaza por
-- un UNIQUE compuesto (nombre, presentacion).
--
-- El DROP busca el nombre real del constraint en vez de asumirlo (el nombre
-- autogenerado por Postgres puede variar), para no fallar si no coincide con
-- el patron por defecto "<tabla>_<columna>_key".
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'medicamentos_catalogo'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 1
      AND conkey[1] = (
          SELECT attnum FROM pg_attribute
          WHERE attrelid = 'medicamentos_catalogo'::regclass AND attname = 'nombre'
      );

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE medicamentos_catalogo DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

ALTER TABLE medicamentos_catalogo
    ADD CONSTRAINT medicamentos_catalogo_nombre_presentacion_key UNIQUE (nombre, presentacion);

COMMIT;
