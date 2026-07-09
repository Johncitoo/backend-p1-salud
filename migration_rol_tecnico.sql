-- Rol TECNICO: técnico de mantenimiento en terreno (UAT mantenimiento preventivo
-- de equipos médicos, Pasos 2/5/9/14). Realiza visitas técnicas, registra la
-- inspección/diagnóstico y ejecuta el reemplazo de componentes.
-- Idempotente: se puede correr varias veces sin efecto duplicado.
INSERT INTO roles (nombre, descripcion)
VALUES ('TECNICO', 'Técnico de mantenimiento que realiza atenciones técnicas en terreno.')
ON CONFLICT (nombre) DO NOTHING;
