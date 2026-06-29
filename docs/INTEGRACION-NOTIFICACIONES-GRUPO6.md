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

## Estado actual: modo mock

El Grupo 6 todavía no publicó su API, por lo que la integración arranca en **modo mock**
(`NOTIFICATIONS_ENABLED=false`): las solicitudes solo se imprimen en los logs con el prefijo
`[Notificaciones mock]`, sin enviarse a ningún lado.

## Configuración (variables de entorno)

En `backend-p1-salud/.env`:

```env
# true = envía solicitudes reales; false = solo las loguea (mock)
NOTIFICATIONS_ENABLED=false
NOTIFICATIONS_URL=
NOTIFICATIONS_PATH=/notifications
```

Cuando el Grupo 6 publique su API: llenar `NOTIFICATIONS_URL` (y ajustar `NOTIFICATIONS_PATH`
si su endpoint difiere), poner `NOTIFICATIONS_ENABLED=true` y rebuild.

> En `docker-compose.yml` el backend tiene sus PROPIAS env vars (no lee `.env`). Para
> activar en Docker, cambiar ahí `NOTIFICATIONS_ENABLED` y reconstruir.

## Formato de la solicitud

```json
{
  "source": "salud",
  "evento": "visita_agendada",
  "canal": "email",
  "prioridad": "normal",
  "destinatario": { "nombre": "Juan Soto", "email": "...", "telefono": "..." },
  "plantilla": "visita_agendada_paciente",
  "variables": { "paciente": "...", "profesional": "...", "fecha": "...", "hora": "..." }
}
```

- **canal**: `email | sms | push` (por defecto `email`).
- **prioridad**: `alta | normal | baja`.
- **plantilla**: identificador para que el Grupo 6 elija el contenido del mensaje.
- **variables**: datos dinámicos para rellenar la plantilla.

## Eventos implementados (reactivos)

| Evento | Se dispara en | Destinatario(s) | Prioridad |
|--------|---------------|-----------------|-----------|
| `paciente_creado` | `PacientesService.create()` | paciente | normal |
| `profesional_creado` | `ProfesionalesService.create()` | profesional (vía su usuario) | normal |
| `visita_agendada` | `VisitasService.create()` | paciente **y** profesional | normal |
| `visita_cancelada` | `VisitasService.cancelar()` | paciente **y** profesional | alta |
| `visita_reprogramada` | `VisitasService.cambiarEstado()` con estado `REPROGRAMADA` | paciente **y** profesional | alta |

En los eventos de visita se envían **2 solicitudes** (una al paciente, otra al profesional),
cada una con su plantilla específica (`<evento>_paciente` y `<evento>_profesional`).

## Arquitectura

- **`NotificacionesService`** (`src/integrations/notificaciones/notificaciones.service.ts`):
  método privado `enviar()` que hace el POST, y un método público por evento que arma el
  payload. Es **stateless** (no inyecta repositorios).
- **`NotificacionesModule`**: exporta `NotificacionesService`. Se importa en los módulos que
  emiten notificaciones (pacientes, profesionales, visitas).
- El enriquecimiento de datos (obtener email/teléfono del paciente y del profesional) se hace
  en el service que llama, antes de invocar el método de notificación:
  - Paciente: tiene `email`/`telefono` directo en la entidad.
  - Profesional: el contacto viene de su `Usuario` asociado (`profesional.usuarioId`).

### Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `src/integrations/notificaciones/notificaciones.service.ts` | Servicio cliente + métodos por evento |
| `src/integrations/notificaciones/notificaciones.module.ts` | Módulo |
| `src/pacientes/pacientes.service.ts` | Emite `paciente_creado` |
| `src/profesionales/profesionales.service.ts` | Emite `profesional_creado` (reusa lookup de usuario) |
| `src/visitas/visitas.service.ts` | Emite eventos de visita (helper `obtenerContactosVisita`) |

## Cómo probar (modo mock)

1. Levantar el backend (local o Docker).
2. Crear un paciente / agendar una visita / cancelarla vía API (requiere token Keycloak).
3. Verificar en los logs:
   ```
   [Notificaciones mock] visita_agendada → juan@example.com:
   { "source": "salud", "evento": "visita_agendada", ... }
   ```
   En eventos de visita deberían aparecer **2 logs** (paciente y profesional).

## Pendiente / fase 2

- **Recordatorio "día antes de la cita"**: requiere `@nestjs/schedule` con un `@Cron()` diario
  que busque las visitas del día siguiente y envíe un recordatorio por cada una. No está
  implementado (es un evento temporal, no reactivo).
- **Confirmación de entrega**: el Grupo 6 expone eventos de estado (`enviado`, `entregado`,
  `rechazado`). Si queremos rastrearlos, habría que exponer un endpoint que reciba esos
  callbacks. Fuera del alcance actual.
