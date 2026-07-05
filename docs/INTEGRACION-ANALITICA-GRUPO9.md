# Integración con Grupo 9 (Analítica)

Documentación de la integración de eventos entre el sistema de salud domiciliaria
(`salud`) y la plataforma de Analítica del Grupo 9.

## Resumen

Cada vez que se crea o actualiza una entidad relevante en el backend, se envía
automáticamente un evento HTTP `POST` a la API del Grupo 9. El envío es
**no bloqueante**: si falla, se loguea el error pero la operación principal
(crear/actualizar) nunca se interrumpe.

## Configuración (variables de entorno)

En `backend-p1-salud/.env`:

```env
# true = envía eventos reales; false = solo los loguea en consola (modo mock para pruebas)
ANALYTICS_ENABLED=false
ANALYTICS_URL=https://analisis-proyecto-ti.onrender.com
ANALYTICS_EVENTS_PATH=/v1/events
```

- **ANALYTICS_ENABLED**: interruptor maestro. Con `false`, los eventos se imprimen
  en los logs con el prefijo `[Analytics mock]` y NO se envían. Útil para desarrollo.
- **ANALYTICS_URL**: URL base de la API del Grupo 9.
- **ANALYTICS_EVENTS_PATH**: ruta del endpoint de eventos (se concatena a la URL base).

El endpoint final resultante es: `https://analisis-proyecto-ti.onrender.com/v1/events`

## Formato de los eventos

Todos los eventos comparten la misma estructura:

```json
{
  "source": "salud",
  "event_type": "<tipo_de_evento>",
  "payload": { ... }
}
```

## Eventos implementados

| Evento | Se dispara en | Disparadores |
|--------|---------------|-------------|
| `usuario_upsert` | `UsuariosService` | `create()`, `update()` |
| `paciente_upsert` | `PacientesService` | `create()`, `update()` |
| `profesional_upsert` | `ProfesionalesService` | `create()`, `update()` |
| `zona_upsert` | `ZonasService` | `create()`, `update()` |
| `especialidad_upsert` | `ProfesionalesService` | `createEspecialidad()`, `updateEspecialidad()` |
| `visita_upsert` | `VisitasService` | `create()`, `update()`, `cambiarEstado()`, `completar()`, `cancelar()` |
| `visita_inicio` | `VisitasService` | `cambiarEstado()` cuando estado → `EN_ATENCION` |
| `visita_fin` | `VisitasService` | `cambiarEstado()` cuando estado → `REALIZADA`, y `completar()` |
| `ficha_upsert` | `FichasClinicasService` | `create()`, `update()`, `cerrar()` |

> **Nota:** `alerta_upsert` (evento del Grupo 9) **no está implementado** todavía
> porque el sistema aún no tiene módulo NestJS de alertas (la tabla `alertas`
> existe en la BD pero falta el entity/service/controller).

### Detalle de payloads

#### usuario_upsert
```json
{ "usuario_id": "UUID", "nombres": "...", "apellidos": "...",
  "rut": "...", "email": "...", "telefono": "...", "activo": true }
```
Mapeo directo desde la entidad `Usuario` (vía `UsuarioResponse`).

#### paciente_upsert
```json
{ "paciente_id": "UUID", "nombres": "...", "apellidos": "...",
  "rut": "...", "fecha_nacimiento": "YYYY-MM-DD", "sexo": "M|F|O",
  "telefono": "...", "email": "...", "direccion": "..." }
```
`fechaNacimiento` se formatea a `YYYY-MM-DD`.

#### profesional_upsert
```json
{ "profesional_id": "UUID", "usuario_id": "UUID", "nombres": "...",
  "apellidos": "...", "profesion": "...", "numero_registro": "...", "activo": true }
```
`nombres` y `apellidos` se obtienen del `Usuario` asociado (lookup por `usuarioId`).

#### zona_upsert
```json
{ "zona_id": "UUID", "nombre": "...", "descripcion": "...",
  "comuna": "...", "region": "...", "activa": true }
```
Mapeo directo desde la entidad `Zona`.

#### especialidad_upsert
```json
{ "especialidad_id": "UUID", "nombre": "...", "descripcion": "..." }
```
Mapeo directo desde la entidad `Especialidad`.

#### visita_inicio
```json
{ "visita_id": "UUID", "fecha_inicio_real": "ISO8601" }
```
Solo se envía si `fechaHoraInicioReal` tiene valor.

#### visita_fin
```json
{ "visita_id": "UUID", "fecha_fin_real": "ISO8601",
  "estado": "completada", "completada": 1, "puntual": 0 }
```
Solo se envía si `fechaHoraFinReal` tiene valor.

#### ficha_upsert
```json
{ "ficha_id": "UUID", "visita_id": "UUID", "estado": "DRAFT|COMPLETED|ARCHIVED",
  "contenido": "<JSON string>", "usuario_creador_id": "UUID",
  "usuario_actualizador_id": "UUID", "tiene_adjuntos": "0|1", "cantidad_adjuntos": "N" }
```
- El `contenido` (JSONB) se serializa con `JSON.stringify`.
- `tiene_adjuntos` y `cantidad_adjuntos` se calculan con un conteo en vivo sobre
  `documentos_adjuntos` (solo adjuntos con `deleted_at IS NULL`).

## Mapeos de valores

Algunos valores del sistema se traducen a los que espera el Grupo 9:

### Estado de visita (`normalizeVisitaEstado`)
| Sistema | Grupo 9 |
|---------|---------|
| REALIZADA, FINALIZADA, TERMINADA, COMPLETADA | `completada` |
| EN_ATENCION, EN_CAMINO, INICIADA, EN_CURSO | `en_proceso` |
| CANCELADA, NO_REALIZADA, ANULADA | `cancelada` |
| (resto) | `programada` |

### Estado de ficha (`normalizeFichaEstado`)
| Sistema | Grupo 9 |
|---------|---------|
| BORRADOR | `DRAFT` |
| CERRADA | `COMPLETED` |
| ANULADA | `ARCHIVED` |

## Arquitectura

- **`AnalyticsService`** (`src/integrations/analytics/analytics.service.ts`):
  centraliza toda la lógica. Tiene un método privado `sendEvent()` que hace el
  POST HTTP, y un método público por cada tipo de evento que construye el payload.
- **`AnalyticsModule`**: exporta `AnalyticsService`. Se importa en cada módulo que
  necesita emitir eventos (usuarios, pacientes, profesionales, zonas, fichas-clínicas,
  visitas).
- El `AnalyticsService` es **stateless**: no inyecta repositorios. El enriquecimiento
  de datos (nombres del profesional, conteo de adjuntos) se hace en el service que
  llama, antes de invocar el método de analítica.

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/integrations/analytics/analytics.service.ts` | Método genérico `sendEvent` + 8 métodos nuevos + tipos + mapeos |
| `src/zonas/zonas.module.ts` / `.service.ts` | Import módulo + emitir `zona_upsert` |
| `src/usuarios/usuarios.module.ts` / `.service.ts` | Import módulo + emitir `usuario_upsert` |
| `src/pacientes/pacientes.module.ts` / `.service.ts` | Import módulo + emitir `paciente_upsert` |
| `src/profesionales/profesionales.module.ts` / `.service.ts` | Import módulo + emitir `profesional_upsert` y `especialidad_upsert` |
| `src/fichas-clinicas/fichas-clinicas.module.ts` / `.service.ts` | Import módulo + emitir `ficha_upsert` con conteo de adjuntos |
| `src/visitas/visitas.service.ts` | Emitir `visita_inicio` y `visita_fin` |
| `.env` / `.env.example` | Config de la integración |

## Cómo probar

### Modo mock (sin enviar nada real)
1. Con `ANALYTICS_ENABLED=false` en `.env`.
2. Levantar el backend: `npm run start:dev`.
3. Crear/actualizar una entidad (ej. una zona desde el frontend o vía API).
4. Verificar en los logs un mensaje:
   ```
   [Analytics mock] Evento zona_upsert:
   { "source": "salud", "event_type": "zona_upsert", "payload": {...} }
   ```

### Modo real (envío a producción del Grupo 9)
1. Cambiar a `ANALYTICS_ENABLED=true` en `.env`.
2. Reiniciar el backend.
3. Crear/actualizar una entidad.
4. Si el POST falla, aparecerá en logs:
   `No se pudo enviar evento <tipo> a Analítica: HTTP <status>`.
   Si no aparece error, el evento se entregó correctamente.

## Pendiente / futuro

- **`alerta_upsert`**: requiere crear el módulo NestJS de alertas (entity, service,
  controller) sobre la tabla `alertas` ya existente. El `AnalyticsService` ya tiene
  preparado el patrón para agregar `sendAlertaUpsertEvent` cuando exista el módulo.
  Recordar los mapeos que pide el Grupo 9:
  - prioridad: BAJA→LOW, MEDIA→MEDIUM, ALTA→HIGH, CRITICA→CRITICAL
  - estado: ABIERTA→OPEN, EN_REVISION→IN_PROGRESS, RESUELTA/CERRADA→CLOSED
  - `dias_abierta`: calcular desde `created_at`
