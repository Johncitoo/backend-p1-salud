BEGIN;

-- La columna "url" quedo como NOT NULL de un diseno viejo (antes de que los
-- archivos se guardaran cifrados via object_key + storage_provider). El
-- codigo actual (DocumentosAdjuntosService.upload) manda url: null a
-- proposito, por lo que cualquier subida de archivo fallaba con 500
-- ("null value in column url violates not-null constraint").
ALTER TABLE public.documentos_adjuntos ALTER COLUMN url DROP NOT NULL;

COMMIT;
