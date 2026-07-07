# Integración con Grupo 6 (Notificaciones)

Documentación de la integración entre el sistema de salud domiciliaria (`salud`) y la
Plataforma de notificaciones multicanal del Grupo 6 (Proyecto 6).

## Resumen

Cuando ocurre un evento relevante en nuestro sistema (se crea un paciente/profesional, se
agenda/cancela/reprograma una visita), enviamos una **solicitud de notificación** vía HTTP
`POST` al Grupo 6. Ellos se encargan del envío real (email/SMS/push).

**Nosotros NO enviamos correos ni SMS** — solo le pasamos la solicitud al Grupo 6 con los
datos del destinatario, la plantilla a usar y las variables. El envío es **no bloqueante**:
si falla, se loguea el error pero la operación principal nunca se interrumpe.

## Estado actual: integración real activa

El Grupo 6 publicó su API (`https://ucn-agil-notificaciones.up.railway.app`) y la integración
ya la usa (`NOTIFICATIONS_ENABLED=true`). El modo mock (`NOTIFICATIONS_ENABLED=false`) sigue
disponible para desarrollo sin mandar correos reales: las solicitudes solo se imprimen en los
logs con el prefijo `[Notificaciones mock]`.

## Configuración (variables de entorno)

En `backend-p1-salud/.env`:

```env
NOTIFICATIONS_ENABLED=true
NOTIFICATIONS_URL=https://ucn-agil-notificaciones.up.railway.app
NOTIFICATIONS_PATH=/notifications/send
NOTIFICATIONS_API_KEY=4uaAfZTtCtETT8xlxcQrbZKT1SKRqGYe
```

> En `docker-compose.yml` el backend tiene sus PROPIAS env vars (no lee `.env`). Para
> activar en Docker, cambiar ahí las mismas variables y reconstruir.

El header de autenticación es `x-api-key` (confirmado probando el endpoint real; no está
documentado explícitamente en la spec que compartió el Grupo 6).

## Formato de la solicitud

Contrato real (confirmado contra `POST /notifications/send`):

```json
{
  "channel": "email",
  "recipient": { "email": "...", "telefono": "..." },
  "subject": "Confirmación de tu hora de atención domiciliaria",
  "body": { "email": "<p>...</p>", "sms": "..." }
}
```

- **channel**: `email | sms`. Con destinatario que tiene ambos, se manda `channel: "email"`
  con `recipient.telefono` y `body.sms` como fallback (patrón "Email con fallback a SMS" de
  la doc del Grupo 6).
- **subject**/**body.email**: a diferencia del diseño anterior (plantilla + variables,
  especulativo mientras no publicaban su API), **nosotros** armamos el asunto y el HTML final
  en `NotificacionesService` — el Grupo 6 no resuelve plantillas de nuestro lado.
- **Respuesta**: `202` con `{ notificationId, jobId }`, que guardamos en
  `notificaciones_enviadas` para poder consultar su estado despues (ver "Seguimiento de
  entrega" más abajo).

## Eventos implementados (reactivos)

| Evento | Se dispara en | Destinatario(s) | Prioridad |
|--------|---------------|-----------------|-----------|
| `paciente_creado` | `PacientesService.create()` | paciente | normal |
| `profesional_creado` | `ProfesionalesService.create()` | profesional (vía su usuario) | normal |
| `visita_agendada` | `VisitasService.create()` | paciente **y** profesional | normal |
| `visita_cancelada` | `VisitasService.cancelar()` | paciente **y** profesional | alta |
| `visita_reprogramada` | `VisitasService.cambiarEstado()` con estado `REPROGRAMADA` | paciente **y** profesional | alta |
| `profesional_en_camino` | `VisitasService.cambiarEstado()` con estado `EN_CAMINO` | **solo** paciente | normal |
| `recordatorio_visita` | `VisitasService.enviarRecordatoriosDelDiaSiguiente()` (`@Cron` diario, 09:00) | paciente **y** profesional | normal |

En los eventos de visita con ambos destinatarios se envían **2 solicitudes** (una al paciente,
otra al profesional), cada una con su propio asunto/contenido. `profesional_en_camino` es la
excepción: solo se notifica al paciente (es quien necesita saber que el profesional está en
tránsito). Este evento lo dispara el botón "Iniciar Ruta hacia el Domicilio" de la app móvil
(`frontappsalud`), que ahora encola un `PATCH /visitas/:id/estado` con `estado: EN_CAMINO`
además de actualizar su estado local.

## Arquitectura

- **`NotificacionesService`** (`src/integrations/notificaciones/notificaciones.service.ts`):
  método privado `enviar()` que hace el POST y guarda el `notificationId` devuelto en
  `notificaciones_enviadas`, y un método público por evento que arma el payload. Ya no es
  stateless: inyecta el repositorio de `NotificacionEnviada` para el seguimiento.
- **`NotificacionesModule`**: exporta `NotificacionesService`, expone `NotificacionesController`
  (`GET /notificaciones-enviadas`, `GET /notificaciones-enviadas/:id/tracking`) e importa
  `UsuariosModule` (lo requiere `DevAuthGuard`). Se importa en los módulos que emiten
  notificaciones (pacientes, profesionales, visitas).
- El enriquecimiento de datos (obtener email/teléfono del paciente y del profesional) se hace
  en el service que llama, antes de invocar el método de notificación:
  - Paciente: tiene `email`/`telefono` directo en la entidad.
  - Profesional: el contacto viene de su `Usuario` asociado (`profesional.usuarioId`).

### Seguimiento de entrega

Cada solicitud aceptada (`202`) queda registrada en la tabla `notificaciones_enviadas`
(`evento`, `visita_id`, `paciente_id`, destinatario, `notification_id`, `job_id`, `estado`
local con valor inicial `enviado`). Endpoints (roles ADMIN/COORDINADOR/PROFESIONAL/SUPERVISOR):

- `GET /notificaciones-enviadas?visitaId=&pacienteId=` — lista lo enviado, filtrable.
- `GET /notificaciones-enviadas/:id/tracking` — consulta en vivo
  `GET {NOTIFICATIONS_URL}/tracking/:notificationId`, actualiza el `estado` local con la
  respuesta (`pending`/`sent`/`failed`) y la devuelve junto con el `statusHistory` completo
  del Grupo 6 (`trackingRaw`). No hay webhook: el estado local solo se refresca cuando se
  llama a este endpoint.

**Nota de esquema**: `synchronize` está en `false` en este backend, así que la tabla
`notificaciones_enviadas` se creó a mano (mismo patrón que `documentos_adjuntos`/local
storage) — ver el `CREATE TABLE` en `entities/notificacion-enviada.entity.ts` si hay que
recrearla en otro ambiente.

### Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `src/integrations/notificaciones/notificaciones.service.ts` | Servicio cliente + métodos por evento + tracking |
| `src/integrations/notificaciones/notificaciones.controller.ts` | `GET` de notificaciones enviadas y su tracking |
| `src/integrations/notificaciones/entities/notificacion-enviada.entity.ts` | Entidad `notificaciones_enviadas` |
| `src/integrations/notificaciones/notificaciones.module.ts` | Módulo |
| `src/pacientes/pacientes.service.ts` | Emite `paciente_creado` |
| `src/profesionales/profesionales.service.ts` | Emite `profesional_creado` (reusa lookup de usuario) |
| `src/visitas/visitas.service.ts` | Emite eventos de visita (helper `obtenerContactosVisita`) + `@Cron` de recordatorios |
| `frontend-p1-salud/frontappsalud/src/screens/VisitDetailScreen.tsx` | `handleIniciarRuta` encola `EN_CAMINO` |
| `frontend-p1-salud/frontappsalud/src/services/syncService.ts` | Sincroniza `EN_CAMINO` → `PATCH /visitas/:id/estado` |

## Cómo probar

**Modo mock** (`NOTIFICATIONS_ENABLED=false`):
1. Levantar el backend (local o Docker).
2. Crear un paciente / agendar una visita / cancelarla vía API (requiere token Keycloak o mock).
3. Verificar en los logs:
   ```
   [Notificaciones mock] visita_agendada → juan@example.com:
   { "channel": "email", "recipient": {...}, "subject": "...", "body": {...} }
   ```
   En eventos de visita deberían aparecer **2 logs** (paciente y profesional).

**Modo real** (`NOTIFICATIONS_ENABLED=true`): igual que arriba, pero el correo se envía de
verdad — usar un email de prueba propio, no el de un paciente real, para no spamear
direcciones ajenas. Verificado en vivo (2026-07-06): `PATCH /visitas/:id/estado` con
`estado: EN_CAMINO` sobre una visita con paciente de email de prueba, sin errores en el log
(éxito es silencioso; solo se loguean fallos).

## Fase 2 (implementada 2026-07-06)

- **Recordatorio "día antes de la cita"**: `VisitasService.enviarRecordatoriosDelDiaSiguiente()`,
  con `@Cron('0 9 * * *')` (09:00 hora del servidor). Busca visitas con `fechaProgramada` =
  mañana que no estén `CANCELADA`/`REALIZADA`/`NO_REALIZADA`/`REPROGRAMADA`, y notifica a
  paciente y profesional (evento `recordatorio_visita`).
- **Confirmación de entrega**: implementada vía tabla `notificaciones_enviadas` +
  `GET /notificaciones-enviadas/:id/tracking` (ver sección "Seguimiento de entrega" arriba).

## Pendiente

- El `@Cron` de recordatorios no tiene test de integración (solo se probó el envío puntual
  vía `notificarRecordatorioVisita` a través de los tests unitarios existentes de
  `NotificacionesService`; el disparo automático diario no se ha corrido en vivo).
- No hay reintento automático para notificaciones con `estado: failed` — hay que revisar
  manualmente vía `GET /notificaciones-enviadas` y decidir si reenviar.
