# Avances de sesión — 28 y 29 de junio de 2026

Resumen completo de todo lo implementado durante esta sesión de trabajo.

---

## 1. Integración con Grupo 9 — Analítica (Proyecto 9)

**Qué hicimos:** Implementamos el envío automático de eventos al sistema de analítica
del Grupo 9 cada vez que se crea o actualiza una entidad relevante en nuestro sistema.

**URL del Grupo 9:** `https://analisis-proyecto-ti.onrender.com/v1/events`

### Eventos implementados (9 total)

| Evento | Se dispara en | Estado |
|--------|---------------|--------|
| `usuario_upsert` | Crear/actualizar usuario | Implementado y probado |
| `paciente_upsert` | Crear/actualizar paciente | Implementado y probado |
| `profesional_upsert` | Crear/actualizar profesional | Implementado y probado |
| `zona_upsert` | Crear/actualizar zona | Implementado y probado |
| `especialidad_upsert` | Crear/actualizar especialidad | Implementado y probado |
| `visita_upsert` | Crear/actualizar/cambiar estado visita | Ya existía, se mantiene |
| `visita_inicio` | Visita pasa a EN_ATENCION | Implementado y probado |
| `visita_fin` | Visita pasa a REALIZADA / se completa | Implementado y probado |
| `ficha_upsert` | Crear/actualizar/cerrar ficha clínica | Implementado y probado |
| `alerta_upsert` | Crear/actualizar alerta | Implementado |

### Archivos principales
- `src/integrations/analytics/analytics.service.ts` — método genérico `sendEvent()` + 10 métodos públicos
- Enganchado en: `usuarios.service.ts`, `pacientes.service.ts`, `profesionales.service.ts`, `zonas.service.ts`, `fichas-clinicas.service.ts`, `visitas.service.ts`, `alertas.service.ts`

### Mapeos de valores
- Estado visita: REALIZADA→completada, EN_ATENCION→en_proceso, CANCELADA→cancelada
- Estado ficha: BORRADOR→DRAFT, CERRADA→COMPLETED, ANULADA→ARCHIVED
- Prioridad alerta: BAJA→LOW, MEDIA→MEDIUM, ALTA→HIGH, CRITICA→CRITICAL
- Estado alerta: ABIERTA→OPEN, EN_REVISION→IN_PROGRESS, RESUELTA/CERRADA→CLOSED
- `dias_abierta`: calculado dinámicamente desde `created_at`

### Verificación
- Probado end-to-end en Docker: creación de zona, especialidad, paciente, usuario, profesional, visita (ciclo completo), ficha clínica
- Todos los payloads verificados contra el formato que espera el Grupo 9
- 24 tests unitarios para el AnalyticsService

### Configuración
```env
ANALYTICS_ENABLED=false    # true = envía real, false = solo loguea (mock)
ANALYTICS_URL=https://analisis-proyecto-ti.onrender.com
ANALYTICS_EVENTS_PATH=/v1/events
```

### Documentación
- `docs/INTEGRACION-ANALITICA-GRUPO9.md`

---

## 2. Integración con Grupo 6 — Notificaciones (Proyecto 6)

**Qué hicimos:** Creamos un módulo que envía solicitudes de notificación al Grupo 6
cuando ocurren eventos relevantes (crear paciente, agendar visita, cancelar, etc.).

**Estado:** Modo mock — el Grupo 6 aún no publica su API.

### Eventos implementados (5)

| Evento | Se dispara en | Destinatarios | Prioridad |
|--------|---------------|---------------|-----------|
| `paciente_creado` | Crear paciente | Paciente | Normal |
| `profesional_creado` | Crear profesional | Profesional | Normal |
| `visita_agendada` | Crear visita | Paciente + Profesional | Normal |
| `visita_cancelada` | Cancelar visita | Paciente + Profesional | Alta |
| `visita_reprogramada` | Estado → REPROGRAMADA | Paciente + Profesional | Alta |

### Archivos principales
- `src/integrations/notificaciones/notificaciones.service.ts` — cliente HTTP + 5 métodos
- `src/integrations/notificaciones/notificaciones.module.ts`
- Enganchado en: `pacientes.service.ts`, `profesionales.service.ts`, `visitas.service.ts`

### Verificación
- Probado end-to-end en Docker: crear paciente, crear visita, cancelar visita
- Verificados los 2 logs por evento de visita (paciente + profesional)
- 15 tests unitarios para el NotificacionesService

### Configuración
```env
NOTIFICATIONS_ENABLED=false
NOTIFICATIONS_URL=
NOTIFICATIONS_PATH=/notifications
```

### Documentación
- `docs/INTEGRACION-NOTIFICACIONES-GRUPO6.md`

---

## 3. Integración con Grupo 8 — IoT (Proyecto 8)

**Qué hicimos:** Creamos un módulo proxy que consume la API del Grupo 8 para obtener
datos de sensores médicos simulados (telemetría y alertas).

**URL del Grupo 8:** `https://iot-platform-backend-bm5b.onrender.com`

### Endpoints proxy creados

| Nuestro endpoint | Proxy a Grupo 8 |
|------------------|-----------------|
| `GET /iot/health` | `/health` |
| `GET /iot/sensors` | `/sensors` |
| `GET /iot/sensors/latest` | `/sensors/latest` |
| `GET /iot/sensors/:sensorId` | `/sensors/sensor/:sensorId` |
| `GET /iot/alerts` | `/alerts` |
| `GET /iot/alerts/:sensorId` | `/alerts/sensor/:sensorId` |

### Mapeo de telemetría a variables clínicas
| Campo IoT | Variable clínica | Unidad |
|-----------|------------------|--------|
| `oxygenSaturation` | `saturacion_oxigeno` | % |
| `heartRate` | `frecuencia_cardiaca` | lpm |
| `systolicPressure` | `presion_arterial_sistolica` | mmHg |
| `diastolicPressure` | `presion_arterial_diastolica` | mmHg |
| `temperature` | `temperatura` | °C |
| `glucoseLevel` | `glicemia_capilar` | mg/dL |

### Archivos principales
- `src/integrations/iot/iot.service.ts` — cliente HTTP + `extractMediciones()`
- `src/integrations/iot/iot.controller.ts` — 6 endpoints proxy
- `src/integrations/iot/iot.module.ts`

### Configuración
```env
IOT_ENABLED=false
IOT_API_URL=https://iot-platform-backend-bm5b.onrender.com
```

### Documentación
- `docs/INTEGRACION-IOT-GRUPO8.md`

---

## 4. Integración con Grupo 12 — Identidades y Accesos (Proyecto 12)

**Qué hicimos:** Configuramos el frontend y backend para autenticarse contra el
Keycloak centralizado del Grupo 12 (administrado por Yamira/Blopa).

### Configuración aplicada

**Frontend:**
```env
VITE_KEYCLOAK_URL=https://underarm-those-stardust.ngrok-free.dev
VITE_KEYCLOAK_REALM=sistema-centralizado
VITE_KEYCLOAK_CLIENT_ID=p1
VITE_KEYCLOAK_ACCESS_ROLE=p1-access
```

**Backend:**
```env
AUTH_MODE=keycloak
KEYCLOAK_ISSUER=https://underarm-those-stardust.ngrok-free.dev/realms/sistema-centralizado
KEYCLOAK_JWKS_URI=https://underarm-those-stardust.ngrok-free.dev/realms/sistema-centralizado/protocol/openid-connect/certs
KEYCLOAK_AUDIENCE=p1
```

### Cambios de código
- `frontend-p1-salud/src/features/auth/keycloak.ts` — funciones `getKeycloakAppRoles()` y `getKeycloakAppRole()` para leer roles de `resource_access.p1.roles`
- `frontend-p1-salud/Dockerfile` — ARG `VITE_KEYCLOAK_ACCESS_ROLE`

### Flujo de autenticación
1. Frontend redirige al Keycloak del Grupo 12
2. Usuario se autentica → recibe JWT con `realm_access.roles` (incluye `p1-access`) y `resource_access.p1.roles` (ej: `admin`)
3. Frontend verifica `p1-access` → si no tiene, muestra "Acceso denegado"
4. Frontend envía JWT al backend en cada request
5. Backend valida firma del JWT contra JWKS del Keycloak del Grupo 12
6. Backend busca usuario local por `sub` (identity_user_id) o email → retorna perfil con rol de la BD

### Usuarios creados en la BD local

| Email | Clave | Rol |
|-------|-------|-----|
| `p1.admin.01@test.local` | `12345` | ADMIN |
| `p1.admin.02@test.local` | `Admin#2026_02` | ADMIN |
| `p1.coordinator.01@test.local` | `Coord#2026_01` | COORDINADOR |
| `p1.coordinator.02@test.local` | `Coord#2026_02` | COORDINADOR |
| `p1.professional.01@test.local` | `Prof#2026_01` | PROFESIONAL |
| `p1.professional.02@test.local` | `Prof#2026_02` | PROFESIONAL |
| `p1.supervisor.01@test.local` | `Sup#2026_01` | SUPERVISOR |
| `p1.supervisor.02@test.local` | `Sup#2026_02` | SUPERVISOR |

### Verificación
- Probado login con `p1.admin.01@test.local` — dashboard carga correctamente
- El backend valida el token y encuentra el usuario local

### Problemas conocidos
- La URL de ngrok es temporal — si Yamira reinicia, hay que actualizar las variables
- El logout falla porque Yamira no registró `localhost:5173` como post-logout redirect URI

### Documentación
- `docs/INTEGRACION-IDENTIDADES-GRUPO12.md`

---

## 5. Módulos de prioridad alta (nuevos)

### Alertas (`/alertas`)
- CRUD completo: GET (filtros por paciente/visita/estado/prioridad), POST, PATCH, DELETE
- Prioridades: BAJA, MEDIA, ALTA, CRITICA
- Estados: ABIERTA, EN_REVISION, RESUELTA, CERRADA, CANCELADA
- Integración automática con Grupo 9 (`alerta_upsert`)
- 7 tests unitarios

### Motivos de cancelación (`/motivos-cancelacion`)
- CRUD completo con validación de código único
- Filtro por `aplicaA` (VISITA, PLAN_CUIDADO, PRESTACION, GENERAL)
- Ya tenía datos seed en la BD (PACIENTE_NO_DISPONIBLE, PROFESIONAL_NO_DISPONIBLE, etc.)
- 6 tests unitarios

### Motivos de reprogramación (`/motivos-reprogramacion`)
- CRUD completo con validación de código único
- Ya tenía datos seed en la BD (AJUSTE_AGENDA, SOLICITUD_PACIENTE, etc.)
- 9 tests unitarios

---

## 6. Módulos restantes de la BD (8 módulos)

Todas las tablas que existían en la BD pero no tenían módulo NestJS.

### Disponibilidades de profesionales (`/disponibilidades`)
- CRUD completo
- Horarios por profesional, zona y día de la semana (1-7)
- Filtro por `profesionalSaludId`
- 5 tests unitarios

### Bloqueos de agenda (`/bloqueos-agenda`)
- CRUD con soft delete
- Tipos: GENERAL, PROFESIONAL, ZONA
- Estados: ACTIVO, CANCELADO
- Rastreo de quién creó/canceló
- 4 tests unitarios

### Reglas de asignación (`/reglas-asignacion`)
- CRUD con soft delete y código único
- Condiciones y acciones en JSONB
- Ordenadas por prioridad
- 5 tests unitarios

### Reprogramaciones de visita (`/reprogramaciones-visita`)
- Append-only (solo GET y POST, sin update ni delete)
- Registra fecha/hora anterior y nueva, motivo y quién reprogramó
- Filtro por `visitaId`
- 3 tests unitarios

### Historial de estados de visita (`/visita-estado-historial`)
- Append-only
- Registra estado anterior, estado nuevo, motivo, observación, quién cambió
- Filtro por `visitaId`
- 3 tests unitarios

### Checkpoints de visita (`/visita-checkpoints`)
- Append-only
- CHECK_IN y CHECK_OUT con geolocalización (latitud, longitud, precisión)
- Orígenes: APP, WEB, OFFLINE_SYNC, ADMIN
- Filtro por `visitaId`
- 3 tests unitarios

### Incidentes de salud (`/incidentes-salud`)
- CRUD completo con soft delete
- Severidad: BAJA, MEDIA, ALTA, CRITICA
- Estados: ABIERTO, EN_REVISION, RESUELTO, CERRADO, CANCELADO
- Vinculado a paciente, visita, alerta, profesional
- Metadata JSONB, tracking de resolución
- 5 tests unitarios

### Historial de estados de incidentes (`/incidente-estado-historial`)
- Append-only
- Registra cambios de estado de incidentes
- Filtro por `incidenteSaludId`
- 3 tests unitarios

---

## 7. Tests unitarios

### Resumen total: 152 tests passed (24 suites)

| Suite | Tests | Qué cubre |
|-------|-------|-----------|
| `analytics.service.spec.ts` | 24 | Todos los eventos del Grupo 9, modo mock/real, mapeos |
| `notificaciones.service.spec.ts` | 15 | Eventos del Grupo 6, plantillas, prioridades |
| `alertas.service.spec.ts` | 7 | CRUD + alerta_upsert + auditoría |
| `motivos-cancelacion.service.spec.ts` | 6 | CRUD + conflict código duplicado |
| `motivos-reprogramacion.service.spec.ts` | 9 | CRUD + findAll + conflict |
| `disponibilidades.service.spec.ts` | 5 | CRUD + valores por defecto |
| `bloqueos-agenda.service.spec.ts` | 4 | CRUD + soft delete |
| `reglas-asignacion.service.spec.ts` | 5 | CRUD + código único |
| `reprogramaciones-visita.service.spec.ts` | 3 | Append-only log |
| `visita-estado-historial.service.spec.ts` | 3 | Append-only log |
| `visita-checkpoints.service.spec.ts` | 3 | Append-only + geolocalización |
| `incidentes-salud.service.spec.ts` | 5 | CRUD + estados + severidad |
| `incidente-estado-historial.service.spec.ts` | 3 | Append-only log |
| Tests pre-existentes (zonas, fichas, etc.) | 60 | Actualizados con mocks nuevos |

### Tests arreglados (pre-existentes que fallaban)
- `zonas.service.spec.ts` — agregado mock de `AnalyticsService`
- `fichas-clinicas.service.spec.ts` — agregado mock de `AnalyticsService` + fix del query builder mock

### Tests que siguen fallando (pre-existentes, no nuestros)
- `documentos-adjuntos.service.spec.ts` — módulo `sharp` no instalado localmente
- `image-optimizer.service.spec.ts` — módulo `sharp` no instalado localmente

---

## 8. Cambios en docker-compose.yml

Se actualizaron las variables de entorno del backend y los build args del frontend
para apuntar al Keycloak del Grupo 12 y tener las URLs de los otros grupos.

### Variables agregadas (backend)
```yaml
ANALYTICS_ENABLED: "false"
ANALYTICS_URL: "https://analisis-proyecto-ti.onrender.com"
ANALYTICS_EVENTS_PATH: /v1/events
NOTIFICATIONS_ENABLED: "false"
NOTIFICATIONS_URL: ""
NOTIFICATIONS_PATH: /notifications
IOT_ENABLED: "false"
IOT_API_URL: "https://iot-platform-backend-bm5b.onrender.com"
KEYCLOAK_ISSUER: https://underarm-those-stardust.ngrok-free.dev/realms/sistema-centralizado
KEYCLOAK_JWKS_URI: https://underarm-those-stardust.ngrok-free.dev/realms/sistema-centralizado/protocol/openid-connect/certs
KEYCLOAK_AUDIENCE: p1
```

### Build args actualizados (frontend)
```yaml
VITE_KEYCLOAK_URL: https://underarm-those-stardust.ngrok-free.dev
VITE_KEYCLOAK_CLIENT_ID: p1
VITE_KEYCLOAK_ACCESS_ROLE: p1-access
```

---

## 9. Credenciales y URLs de otros grupos

| Grupo | Recurso | URL |
|-------|---------|-----|
| Grupo 9 | Backend | `https://analisis-proyecto-ti.onrender.com/` |
| Grupo 9 | Eventos | `https://analisis-proyecto-ti.onrender.com/v1/events` |
| Grupo 9 | Frontend | `https://analisis-proyecto-ti-p7j8.onrender.com/` |
| Grupo 9 | Login | `johndoe@example.com` / `johndoe123` |
| Grupo 8 | Backend IoT | `https://iot-platform-backend-bm5b.onrender.com` |
| Grupo 8 | Swagger | `https://iot-platform-backend-bm5b.onrender.com/docs` |
| Grupo 12 | Keycloak | `https://underarm-those-stardust.ngrok-free.dev` (temporal, ngrok) |
| Grupo 12 | Contacto | Yamira (Blopa) |

---

## 10. Estado final del proyecto

### Tablas de la BD: 32/32 con módulo NestJS
Todas las tablas del `init.sql` ahora tienen entity, service, controller y module correspondiente.

### Integraciones con otros grupos: 4/5 implementadas
| Grupo | Estado |
|-------|--------|
| Grupo 9 — Analítica | ✅ Implementado y probado (10 eventos) |
| Grupo 12 — Identidades | ✅ Implementado y probado (Keycloak centralizado) |
| Grupo 6 — Notificaciones | ✅ Implementado en mock (5 eventos, esperando API) |
| Grupo 8 — IoT | ✅ Módulo proxy creado (6 endpoints) |
| Grupo 7 — CRM | ⏳ Pendiente (ellos nos consumen, falta definir qué necesitan) |

### Tests: 152 passed (24 suites)

### Documentación creada
- `docs/INTEGRACION-ANALITICA-GRUPO9.md`
- `docs/INTEGRACION-NOTIFICACIONES-GRUPO6.md`
- `docs/INTEGRACION-IOT-GRUPO8.md`
- `docs/INTEGRACION-IDENTIDADES-GRUPO12.md`
- `docs/AVANCES-SESION-2026-06-28.md` (este archivo)

---

## 11. Pendientes para futuras sesiones

| Tarea | Prioridad | Detalle |
|-------|-----------|---------|
| Recordatorio "día antes de la cita" | Media | Cron con `@nestjs/schedule` para notificar visitas del día siguiente |
| Activar envío real al Grupo 9 | Media | Cambiar `ANALYTICS_ENABLED=true` en docker-compose |
| Llenar URL del Grupo 6 | Baja | Cuando publiquen su API |
| Tabla `sensores_paciente` | Media | Vincular sensorId del Grupo 8 con pacientes |
| Guardar mediciones IoT automáticamente | Media | Usar `extractMediciones()` para poblar `mediciones_clinicas` |
| Contactar al Grupo 7 (CRM) | Media | Definir qué datos necesitan consumir de nosotros |
| nginx como reverse proxy | Baja | Cuando Juan confirme |
| Post-logout redirect URI | Baja | Pedirle a Yamira que registre localhost:5173 |
