# Esquema de base de datos — Salud en Casa

Extraído directamente de las entidades TypeORM en `src/**/*.entity.ts`. 37 tablas, todas con PK `uuid` autogenerada (`@PrimaryGeneratedColumn('uuid')`).

**Convención clave:** casi ninguna FK usa decoradores de relación de TypeORM (`@ManyToOne`, `@OneToMany`, etc.) — son columnas `uuid` planas sin `@JoinColumn`, y los joins se hacen a mano en los servicios (query builder). Las únicas dos excepciones reales, con relación declarada de verdad, son `PacienteSensor` (→ `Paciente`) y `MedicionClinica` (→ `VariableClinica`); están marcadas abajo.

Casi todas las tablas transaccionales tienen `created_at` / `updated_at` / `deleted_at` (soft delete) — se omiten abajo salvo que la tabla sea un log append-only (no las tiene) o tenga algo distinto que señalar. Las columnas marcadas `?` son nullable. Algunas tablas tienen `version: int` (`@VersionColumn`) para bloqueo optimista en ediciones concurrentes.

---

## Identidad

### `usuarios` (Usuario)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| identity_user_id? | varchar(100) | referencia al proveedor de identidad externo (Keycloak) |
| rol_id | uuid | FK → roles |
| rut | varchar(20) | |
| nombres / apellidos | varchar(100) | |
| email | varchar(150) | |
| telefono? | varchar(30) | |
| activo | boolean | default true |
| ultimo_acceso_at? | timestamp | |

Relaciones: `rol_id` → `roles` (N:1). Referenciada por casi todas las tablas como `creado_por_usuario_id` / `actualizado_por_usuario_id` / `cambiado_por_usuario_id` / etc.

### `roles` (Rol)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| nombre | varchar(50) | |
| descripcion? | text | |

Relaciones: referenciada por `usuarios.rol_id` (1:N).

---

## Pacientes

### `pacientes` (Paciente)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| rut | varchar(20) | |
| nombres / apellidos | varchar(100) | |
| fecha_nacimiento? | date | |
| sexo? | varchar(10) | |
| telefono? | varchar(30) | |
| email? | varchar(150) | |
| direccion? | text | legado — ver `direcciones_paciente` |

Relaciones: referenciada por `alertas`, `visitas`, `contactos_paciente`, `direcciones_paciente`, `planes_cuidado`, `mediciones_clinicas`, `incidentes_salud`, `notificaciones_enviadas`, `paciente_sensores`.

### `contactos_paciente` (ContactoPaciente)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| paciente_id | uuid | FK → pacientes |
| nombre | varchar(100) | |
| telefono? / email? | varchar | |
| relacion? | varchar(50) | ej. "hijo/a", "cónyuge" |
| es_emergencia | boolean | default false |

### `direcciones_paciente` (DireccionPaciente)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| paciente_id | uuid | FK → pacientes |
| zona_id? | uuid | FK → zonas |
| tipo | varchar(30) | default 'DOMICILIO' |
| calle? / numero? / departamento? | varchar | |
| villa_poblacion? | varchar(150) | |
| comuna / region | varchar(100) | |
| referencia? | text | |
| latitud? / longitud? | decimal(10,7) | |
| es_principal | boolean | default false |
| activa | boolean | default true |

### `planes_cuidado` (PlanCuidado)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| paciente_id | uuid | FK → pacientes |
| objetivo? | varchar(255) | |
| descripcion? | text | |
| fecha_inicio? / fecha_fin? | date | |
| estado? | varchar(50) | |

Relaciones: referenciada por `visitas.plan_cuidado_id`.

### `paciente_sensores` (PacienteSensor)
Integración IoT (Proyecto 8). Único compuesto en (asset_id, sensor_id).

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| paciente_id | uuid | FK → pacientes — **`@ManyToOne` declarado (excepción)** |
| asset_id / sensor_id | varchar(150) | unique juntos |
| sensor_type | varchar(50) | |
| is_active | boolean | default true |

---

## Profesionales & zonas

### `profesionales_salud` (ProfesionalSalud)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| usuario_id | uuid | FK → usuarios, ~1:1 en la práctica |
| profesion | varchar(50) | texto libre (no catálogo) — ej. "Enfermería" |
| numero_registro? | varchar(50) | |
| activo | boolean | default true |

Relaciones: referenciada por `visitas`, `disponibilidades_profesionales`, `profesional_especialidad`, `profesional_zona`, `bloqueos_agenda`, `incidentes_salud`, `profesional_google_calendar_connections`.

### `especialidades` (Especialidad)
Catálogo formal de especialidades (distinto del texto libre `profesion` de arriba).

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| nombre | varchar(100) | ej. "Cardiología" |
| descripcion? | text | |

### `profesional_especialidad` (join N:N)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| profesional_salud_id | uuid | FK → profesionales_salud |
| especialidad_id | uuid | FK → especialidades |

### `profesional_zona` (join N:N)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| profesional_salud_id | uuid | FK → profesionales_salud |
| zona_id | uuid | FK → zonas |

### `disponibilidades_profesionales` (DisponibilidadProfesional)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| profesional_salud_id | uuid | FK → profesionales_salud |
| zona_id? | uuid | FK → zonas |
| dia_semana | integer | |
| hora_inicio / hora_fin | time | |
| capacidad_max_visitas? | integer | |
| vigente_desde? / vigente_hasta? | date | |
| activo | boolean | default true |

### `zonas` (Zona)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| nombre | varchar(100) | |
| descripcion? | text | |
| comuna / region | varchar(100) | |
| activa | boolean | default true |

Relaciones: referenciada por `visitas`, `direcciones_paciente`, `disponibilidades_profesionales`, `bloqueos_agenda`, `profesional_zona`.

---

## Visitas & agenda

### `visitas` (Visita)
Tabla central del sistema — casi todo lo demás cuelga de acá. Tiene `version: int` (`@VersionColumn`).

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| paciente_id | uuid | FK → pacientes |
| profesional_salud_id | uuid | FK → profesionales_salud |
| zona_id? | uuid | FK → zonas |
| plan_cuidado_id? | uuid | FK → planes_cuidado |
| direccion_paciente_id? | uuid | FK → direcciones_paciente |
| fecha_programada | date | |
| hora_programada | time | |
| duracion_estimada_min? | integer | |
| fecha_hora_inicio_real? / fin_real? | timestamp | |
| check_in_at? / check_out_at? | timestamp | |
| estado | varchar(30) | default 'PROGRAMADA' |
| prioridad | varchar(20) | default 'NORMAL' |
| creada_por_usuario_id | uuid | FK → usuarios |
| motivo_cancelacion_id? | uuid | FK → motivos_cancelacion |
| cancelada_at? | timestamp | |
| cancelada_por_usuario_id? | uuid | FK → usuarios |
| observacion_cancelacion? | text | |
| google_calendar_connection_id? | uuid | FK → profesional_google_calendar_connections |
| google_calendar_id? / event_id? / event_etag? | varchar(255) | |
| google_calendar_html_link? | text | |
| google_calendar_sync_status | varchar(30) | default 'PENDING' |
| google_calendar_last_sync_at? / last_error? | timestamp / text | |
| google_calendar_sync_attempts | integer | default 0 |
| version | int | `@VersionColumn` |

Referenciada por (1:N): `diagnosticos`, `medicamentos`, `fichas_clinicas`, `visita_checkpoints`, `visita_estado_historial`, `reprogramaciones_visita`, `visita_prestaciones`, `mediciones_clinicas`, `alertas`, `incidentes_salud`, `google_calendar_sync_logs`, `notificaciones_enviadas`.

### `visita_checkpoints` (VisitaCheckpoint)
Log append-only (sin `updated_at`/`deleted_at`). Único compuesto en (visita_id, tipo).

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| visita_id | uuid | FK → visitas |
| tipo | varchar(20) | EN_CAMINO / CHECK_IN / CHECK_OUT |
| fecha_hora | timestamp | default now() |
| latitud? / longitud? | numeric(10,7) | |
| precision_metros? | numeric(10,2) | |
| origen | varchar(30) | default 'APP' |
| observacion? | text | |
| registrado_por_usuario_id | uuid | FK → usuarios |

### `visita_estado_historial` (VisitaEstadoHistorial)
Log append-only.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| visita_id | uuid | FK → visitas |
| estado_anterior? | varchar(30) | |
| estado_nuevo | varchar(30) | |
| motivo? / observacion? | text | |
| cambiado_por_usuario_id | uuid | FK → usuarios |

### `reprogramaciones_visita` (ReprogramacionVisita)
Log append-only.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| visita_id | uuid | FK → visitas |
| fecha_programada_anterior / hora_programada_anterior | date / time | |
| fecha_programada_nueva / hora_programada_nueva | date / time | |
| motivo_reprogramacion_id? | uuid | FK → motivos_reprogramacion |
| observacion? | text | |
| reprogramada_por_usuario_id | uuid | FK → usuarios |

### `bloqueos_agenda` (BloqueoAgenda)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| tipo | varchar(30) | |
| profesional_salud_id? | uuid | FK → profesionales_salud |
| zona_id? | uuid | FK → zonas |
| fecha_hora_inicio / fin | timestamp | |
| motivo | varchar(150) | |
| observacion? | text | |
| estado | varchar(30) | default 'ACTIVO' |
| creado_por_usuario_id | uuid | FK → usuarios |
| cancelado_por_usuario_id? | uuid | FK → usuarios |
| cancelado_at? | timestamp | |

### `motivos_cancelacion` (catálogo)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| codigo | varchar(50) | |
| nombre | varchar(150) | |
| descripcion? | text | |
| aplica_a | varchar(30) | default 'VISITA' |
| requiere_observacion | boolean | default false |
| activo | boolean | default true |

### `motivos_reprogramacion` (catálogo)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| codigo | varchar(50) | |
| nombre | varchar(150) | |
| descripcion? | text | |
| requiere_observacion | boolean | default false |
| activo | boolean | default true |

### `reglas_asignacion` (ReglaAsignacion)
Motor de reglas standalone — sin FKs.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| codigo | varchar(50) | unique |
| nombre | varchar(150) | |
| descripcion? | text | |
| prioridad | integer | default 100 |
| condiciones | jsonb | default {} |
| acciones | jsonb | default {} |
| activa | boolean | default true |

---

## Prestaciones

### `prestaciones` (catálogo)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| codigo | varchar(50) | |
| nombre | varchar(150) | |
| descripcion? | text | |
| duracion_estimada_min? | integer | |
| activa | boolean | default true |

### `visita_prestaciones` (join N:N)
Modela la relación N:N Visita↔Prestación a mano (sin `@ManyToMany`).

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| visita_id | uuid | FK → visitas |
| prestacion_id | uuid | FK → prestaciones |
| cantidad | integer | default 1 |
| estado | varchar(30) | default 'PROGRAMADA' |
| observacion? | text | |

---

## Clínico

### `fichas_clinicas` (FichaClinica)
Solo UNA ficha por visita (regla de negocio en el service, no en el schema). `@VersionColumn`.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| visita_id | uuid | FK → visitas |
| plantilla_ficha_id? | uuid | FK → plantillas_ficha |
| estado | varchar(30) | default 'BORRADOR' |
| contenido | jsonb | default {} — respuestas dinámicas de la plantilla |
| creada_por_usuario_id? / actualizada_por_usuario_id? | uuid | FK → usuarios |
| version | int | `@VersionColumn` |

Referenciada por: `documentos_adjuntos.ficha_clinica_id`, `mediciones_clinicas.ficha_clinica_id`.

### `plantillas_ficha` (PlantillaFicha)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| codigo | varchar(100) | |
| nombre | varchar(150) | |
| descripcion? | text | |
| tipo_atencion? | varchar(80) | |
| activa | boolean | default true |
| creada_por_usuario_id? | uuid | FK → usuarios |

### `plantilla_ficha_campos` (PlantillaFichaCampo)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| plantilla_ficha_id | uuid | FK → plantillas_ficha |
| variable_clinica_id? | uuid | FK → variables_clinicas |
| codigo_campo | varchar(100) | |
| etiqueta | varchar(150) | |
| tipo_campo | varchar(30) | TEXTO_LIBRE / NUMERO_LIBRE / BOOLEANO / SELECT / VARIABLE_CLINICA... |
| obligatorio | boolean | default false |
| orden | int | default 0 |
| ayuda_texto? | text | |
| opciones | jsonb | default {} — para tipo SELECT |
| activo | boolean | default true |

### `variables_clinicas` (VariableClinica)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| codigo | varchar(100) | |
| nombre | varchar(150) | |
| descripcion? / categoria? | text / varchar(80) | |
| tipo_dato | varchar(30) | NUMERO / BOOLEANO / TEXTO... |
| unidad? | varchar(30) | |
| valor_minimo? / valor_maximo? | numeric(12,4) | |
| sinonimos? | text[] | array |
| activa | boolean | default true |

### `mediciones_clinicas` (MedicionClinica)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| ficha_clinica_id? / visita_id? | uuid | FK |
| paciente_id | uuid | FK → pacientes |
| variable_clinica_id | uuid | FK → variables_clinicas — **`@ManyToOne` + `@JoinColumn` declarado (excepción)** |
| valor_numero? | numeric(12,4) | |
| valor_texto? / valor_boolean? / valor_fecha? / valor_json? | text / bool / date / jsonb | solo uno según `tipo_dato` de la variable |
| unidad? | varchar(30) | |
| origen | varchar(30) | default 'FICHA' |
| registrado_por_usuario_id? | uuid | FK → usuarios |
| fecha_medicion | timestamp | default now() |

### `diagnosticos` (Diagnostico)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| visita_id | uuid | FK → visitas — 1 visita admite varios diagnósticos |
| descripcion | text | |
| creado_por_usuario_id? | uuid | FK → usuarios |

### `medicamentos` (Medicamento)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| visita_id | uuid | FK → visitas |
| nombre | varchar(200) | |
| medicamento_catalogo_id? | uuid | FK → medicamentos_catalogo |
| cantidad_cajas | int | default 1 |
| indicaciones? | varchar(300) | |
| creado_por_usuario_id? | uuid | FK → usuarios |

### `medicamentos_catalogo` (catálogo)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| nombre | varchar(200) | unique |
| presentacion? | varchar(100) | |
| activo | boolean | default true |

### `documentos_adjuntos` (DocumentoAdjunto)
Adjuntos cifrados en R2/disco. Self-referencial vía `documento_padre_id` (versionado). `@VersionColumn`.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| ficha_clinica_id | uuid | FK → fichas_clinicas |
| nombre_archivo | varchar(150) | |
| tipo_archivo? / mime_type? | varchar | |
| tamano_bytes? | bigint | |
| hash_archivo? | varchar(128) | |
| url? / descripcion? | text | |
| estado | varchar(30) | default 'ACTIVO' |
| categoria | varchar(50) | default 'GENERAL' — ej. FOTO_CLINICA |
| metadata | jsonb | default {} |
| subido_por_usuario_id? | uuid | FK → usuarios |
| documento_padre_id? | uuid | FK self-referencial → documentos_adjuntos |
| storage_provider | varchar(30) | default 'R2' (o LOCAL) |
| bucket? / object_key? | varchar / text | |
| mime_type_original? / mime_type_almacenado? | varchar(120) | |
| extension_original? / extension_almacenada? | varchar(20) | |
| tamano_original_bytes? / tamano_almacenado_bytes? | bigint | |
| sha256_original? / sha256_almacenado? | varchar(64) | |
| encryption_alg? / encryption_iv? / encryption_tag? / encryption_key_id? | varchar | cifrado en reposo |
| fue_optimizado | boolean | default false |
| ancho_original? / alto_original? / ancho_almacenado? / alto_almacenado? | integer | |
| version | int | `@VersionColumn` |

---

## Alertas & incidentes

### `alertas` (Alerta)
`tipo` es texto libre, no enum — convención de prefijo `IOT_*` para alertas de sensores, `CONTINUIDAD` para seguimiento post-visita.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| paciente_id | uuid | FK → pacientes |
| visita_id? | uuid | FK → visitas, nullable |
| tipo | varchar(50) | texto libre |
| mensaje | text | |
| prioridad | varchar(20) | default 'MEDIA' · BAJA/MEDIA/ALTA/CRITICA |
| estado | varchar(20) | default 'ABIERTA' · ABIERTA/EN_REVISION/RESUELTA/CERRADA/CANCELADA |

### `incidentes_salud` (IncidenteSalud)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| tipo | varchar(80) | |
| severidad | varchar(30) | default 'MEDIA' |
| estado | varchar(30) | default 'ABIERTO' |
| titulo | varchar(180) | |
| descripcion? | text | |
| paciente_id? / visita_id? / alerta_id? / profesional_salud_id? | uuid | FKs, todas nullable |
| responsable_usuario_id? | uuid | FK → usuarios |
| origen | varchar(30) | default 'SISTEMA' |
| external_incident_id? | varchar(150) | referencia al sistema externo (Proyecto 11) |
| metadata | jsonb | default {} |
| creado_por_usuario_id? / resuelto_por_usuario_id? | uuid | FK → usuarios |
| resuelto_at? / cerrado_at? | timestamp | |

Referenciada por: `incidente_estado_historial.incidente_salud_id`.

### `incidente_estado_historial` (log)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| incidente_salud_id | uuid | FK → incidentes_salud |
| estado_anterior? / estado_nuevo | varchar(30) | |
| motivo? / observacion? | text | |
| cambiado_por_usuario_id? | uuid | FK → usuarios |

---

## Integraciones

### `notificaciones_enviadas` (Proyecto 6)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| evento | varchar(60) | |
| visita_id? / paciente_id? | uuid | FK |
| destinatario_email? / destinatario_telefono? | varchar | |
| notification_id | varchar(100) | id externo del servicio de notificaciones |
| job_id? | varchar(100) | |
| estado | varchar(30) | default 'enviado' |

### `profesional_google_calendar_connections` (tokens cifrados)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| profesional_salud_id / usuario_id | uuid | FK |
| google_account_id? / google_account_email? | varchar(255) | |
| calendar_id | varchar(255) | default 'primary' |
| access_token_ciphertext | text | cifrado AES-256-GCM |
| refresh_token_ciphertext? | text | cifrado |
| token_encryption_alg / iv / tag / key_id | varchar | |
| scopes? | text | |
| expires_at? | timestamp | |
| sync_enabled | boolean | default true |
| last_sync_at? / last_sync_error? | timestamp / text | |
| version | int | `@VersionColumn` |

### `google_calendar_sync_logs` (log append-only)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| visita_id? / connection_id? | uuid | FK |
| action / status | varchar(30) | |
| request_payload? / response_payload? | jsonb | |
| error_message? | text | |

---

## Auditoría

### `auditorias` (Auditoria)
Log append-only (sin `updated_at`/`deleted_at`). `entidad_id` es polimórfico: la tabla destino la indica la columna `entidad`, no hay FK real.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| usuario_id | uuid | FK → usuarios |
| entidad | varchar(100) | nombre de la tabla afectada |
| entidad_id | uuid | polimórfico — ver nota arriba |
| accion | varchar(100) | CREAR / ACTUALIZAR / ELIMINAR... |
| detalle? | text | |
| old_values? / new_values? | jsonb | |
| ip_address? / user_agent? | varchar(50) / text | |
| request_id? / endpoint? / metodo_http? | varchar / text | |
| origen | varchar(30) | default 'WEB' |
| fecha_hora | timestamp | default now() |

---

**Resumen:** 37 tablas · todas las PK son `uuid` autogeneradas · convención de soft delete (`deleted_at`) en casi todas las tablas transaccionales, ausente en logs append-only (`*_historial`, `*_sync_logs`, `auditorias`, `notificaciones_enviadas`).
