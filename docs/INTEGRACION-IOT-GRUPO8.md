# Integración con Grupo 8 (Plataforma IoT - Sensores médicos)

Documentación de la integración entre el sistema de salud domiciliaria (Proyecto 1)
y la plataforma IoT del Grupo 8 (Proyecto 8), que gestiona sensores médicos simulados.

## Resumen

El Grupo 8 tiene una plataforma que simula sensores médicos (termómetro, glucómetro,
oxímetro de pulso, esfigmomanómetro) y expone sus lecturas via API REST. Nosotros
**consumimos** su API para obtener datos de telemetría y alertas de sensores.

A diferencia del Grupo 9 (donde nosotros enviamos datos), aquí **nosotros consultamos**
al Grupo 8.

## API del Grupo 8

- **URL producción**: `https://iot-platform-backend-bm5b.onrender.com`
- **Documentación Swagger**: `https://iot-platform-backend-bm5b.onrender.com/docs`

### Endpoints disponibles

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Estado del backend, MongoDB y Kafka |
| GET | `/sensors` | Todas las lecturas de sensores |
| GET | `/sensors/latest` | Última lectura registrada |
| GET | `/sensors/sensor/{sensorId}` | Lecturas de un sensor específico |
| GET | `/alerts` | Todas las alertas |
| GET | `/alerts/sensor/{sensorId}` | Alertas de un sensor específico |
| POST | `/telemetry` | Enviar telemetría (ellos lo usan internamente) |

### Tipos de sensores

| Tipo | Qué mide |
|------|----------|
| `thermometer` | Temperatura |
| `glucometer` | Glucosa |
| `pulse_oximeter` | Saturación de oxígeno + frecuencia cardíaca |
| `sphygmomanometer` | Presión arterial (sistólica/diastólica) |

### Campos de telemetría

```json
{
  "sensorId": "OXI-001",
  "assetId": "PATIENT-001",
  "sensorType": "pulse_oximeter",
  "batteryLevel": 85,
  "connectionStatus": "connected",
  "temperature": 5.4,
  "glucoseLevel": 145,
  "oxygenSaturation": 96,
  "heartRate": 82,
  "systolicPressure": 120,
  "diastolicPressure": 80
}
```

## Lo que implementamos

### IoTService (`src/integrations/iot/iot.service.ts`)

Cliente HTTP que consume la API del Grupo 8. Mismo patrón que analytics/notificaciones:
configurable por env vars, modo mock, no bloqueante.

**Métodos disponibles:**
- `getHealthStatus()` — estado de la plataforma IoT
- `getAllReadings()` — todas las lecturas
- `getLatestReading()` — última lectura
- `getReadingsBySensor(sensorId)` — lecturas de un sensor
- `getAllAlerts()` — todas las alertas
- `getAlertsBySensor(sensorId)` — alertas de un sensor
- `extractMediciones(reading)` — mapea una lectura IoT a pares `{codigoVariable, valor}` para guardar en `mediciones_clinicas`

### IoTController (`src/integrations/iot/iot.controller.ts`)

Proxy REST para que el frontend consulte datos IoT a través de nuestro backend:

| Método | Endpoint nuestro | Proxy a Grupo 8 | Roles permitidos |
|--------|-----------------|-----------------|------------------|
| GET | `/iot/health` | `/health` | ADMIN, COORDINADOR, SUPERVISOR |
| GET | `/iot/sensors` | `/sensors` | Todos |
| GET | `/iot/sensors/latest` | `/sensors/latest` | Todos |
| GET | `/iot/sensors/:sensorId` | `/sensors/sensor/:sensorId` | Todos |
| GET | `/iot/alerts` | `/alerts` | Todos |
| GET | `/iot/alerts/:sensorId` | `/alerts/sensor/:sensorId` | Todos |

### Mapeo de telemetría a variables clínicas

| Campo IoT | Variable clínica (nuestra BD) | Unidad |
|-----------|-------------------------------|--------|
| `oxygenSaturation` | `saturacion_oxigeno` | % |
| `heartRate` | `frecuencia_cardiaca` | lpm |
| `systolicPressure` | `presion_arterial_sistolica` | mmHg |
| `diastolicPressure` | `presion_arterial_diastolica` | mmHg |
| `temperature` | `temperatura` | C |
| `glucoseLevel` | `glicemia_capilar` | mg/dL |

Las variables clínicas ya existen en la BD (seeds en `init.sql`). Las mediciones se
guardan en `mediciones_clinicas` con `origen = 'IOT'`.

## Configuración

```env
# IoT integration with Proyecto 8 (Grupo 8 - Sensores médicos)
IOT_ENABLED=false
IOT_API_URL=https://iot-platform-backend-bm5b.onrender.com
```

- `IOT_ENABLED=false` → modo mock, solo loguea las peticiones
- `IOT_ENABLED=true` → consulta la API real del Grupo 8

## Archivos creados

| Archivo | Rol |
|---------|-----|
| `src/integrations/iot/iot.service.ts` | Cliente HTTP + mapeo de telemetría + escalamiento a alerta/incidente |
| `src/integrations/iot/iot-sync.service.ts` | Orquesta la sincronización manual (pull) por paciente |
| `src/integrations/iot/iot.module.ts` | Módulo NestJS |
| `src/integrations/iot/iot.controller.ts` | Endpoints proxy + gestión de dispositivos para el frontend |
| `src/integrations/iot/entities/paciente-sensor.entity.ts` | Tabla `paciente_sensores` (vínculo paciente↔sensor) |
| `src/app.module.ts` | Registro del IoTModule |

## Estado implementado (ya no es "pendiente/futuro")

Los 3 puntos que originalmente estaban listados como pendientes ya están resueltos:
- **Vinculación sensor↔paciente**: tabla `paciente_sensores` (`UNIQUE(assetId, sensorId)`), gestionada desde el frontend (ficha del paciente → "Vincular Dispositivo IoT").
- **Guardado automático de mediciones**: `processTelemetryReading()` guarda en `mediciones_clinicas` con `origen = 'IOT'`, bajo demanda vía el botón "Sincronizar" (no hay cron periódico).
- **Alertas clínicas automáticas**: `processAlertReading()` crea la alerta y, si la severidad es `CRITICAL`/`HIGH`, escala automáticamente a un incidente (`incidentes_salud`, severidad `CRITICA`). Falta el `alerta_upsert` hacia Grupo 9 (ver memoria del proyecto).

Cobertura de tests unitarios (`iot.service.spec.ts`, 18 casos): mapeo de los 4 tipos de sensor,
exclusión de campos ausentes/NaN, deduplicación de mediciones y alertas, el escalamiento
alerta→incidente según severidad, y el desenvolvimiento de las respuestas paginadas. Todo esto
corre sin depender de la API real del Grupo 8.

### Bugs encontrados y corregidos (2026-07-07, probando contra su API real)

- **Respuestas envueltas en paginación**: `GET /sensors/sensor/{id}` y `GET /alerts/sensor/{id}`
  (y `/sensors`, `/alerts` sin filtrar) devuelven `{ data: [...], page, limit, total }`, no un array
  plano como asumía nuestro código. Esto hacía que `IoTSyncService.syncForPatient()` reportara
  `{ success: true, processed: 0 }` siempre, sin procesar nada, sin lanzar ningún error. Corregido en
  `IoTService` con un desenvolvimiento explícito del campo `data` (`GET /sensors/latest` sí devuelve
  el objeto plano, sin envoltorio, y no se tocó).
- **`severity` en minúsculas**: la API real usa valores como `"warning"` en vez de `"LOW"/"HIGH"/"CRITICAL"`.
  Se normalizó a mayúsculas antes de comparar, para no depender de que Grupo 8 respete un casing exacto.

## Preguntas abiertas para confirmar con el Grupo 8

1. ¿Cómo vinculamos `assetId`/`sensorId` con nuestros pacientes? (hoy es manual vía el modal del frontend)
2. ¿Nos avisan por Kafka/webhook o seguimos hacienda polling? (su `/health` reporta estado de Kafka,
   así que es posible que tengan un mecanismo de eventos que no estamos usando — existió un e2e test
   que asumía un modelo de webhook entrante que nunca se implementó del lado de ellos ni del nuestro;
   se eliminó por estar desactualizado)
3. **[RESUELTO por prueba directa contra su API real, 2026-07-07]** ¿Los `sensorId`/`assetId` son
   estables? — `assetId` es estable (solo existen `PATIENT-001` y `MEDKIT-001` en toda la plataforma,
   compartidos entre todos los grupos que prueben con ellos). `sensorId` **no es estable**: es un
   contador que incrementa en cada ciclo del simulador (`OXI-001` → ... → `OXI-192` y sigue subiendo).
   Esto es un problema real: **las alertas (`/alerts`) no traen `assetId`, solo `sensorId`**, y nuestro
   `processAlertReading()` vincula por `sensorId` exacto — cualquier `sensorId` que vinculemos hoy
   quedará obsoleto apenas el contador avance, y las alertas nuevas nunca van a matchear.
   **Pendiente por preguntarles**: ¿cómo esperan que vinculemos una alerta a un paciente si el
   `sensorId` cambia constantemente y no traen `assetId`? (¿el prefijo `OXI-`/`GLUCO-`/`BP-`/`THERMO-`
   es lo estable y deberíamos matchear por prefijo en vez de ID exacto?)

## Plan de pruebas (para ejecutar cuando el Grupo 8 nos confirme un sensor de prueba)

**Ya validado sin necesitar al Grupo 8** (no repetir, solo correr si se toca el código):
```bash
cd backend-p1-salud
npx jest iot.service.spec   # 14/14 tests: mapeo, dedup, escalamiento a incidente
```

**Paso 1 — Confirmar que su API está arriba** (no requiere datos de prueba):
```bash
curl -H "Authorization: Bearer <token admin/coordinador>" \
  http://localhost:3000/iot/health
```
Esperado: `{ status, service, database, kafka? }`. Si falla, el problema es de ellos, no nuestro.

**Paso 2 — Vincular el sensor de prueba real que nos den** (reemplazar `<pacienteId>`,
`<assetId>`, `<sensorId>` por los valores reales que confirme el Grupo 8):
```bash
curl -X POST http://localhost:3000/iot/paciente-sensores \
  -H "Authorization: Bearer <token admin/coordinador>" \
  -H "Content-Type: application/json" \
  -d '{"pacienteId":"<pacienteId>","assetId":"<assetId>","sensorId":"<sensorId>","sensorType":"pulse_oximeter"}'
```

**Paso 3 — Ver telemetría/alertas crudas antes de sincronizar** (para saber qué esperar):
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/iot/sensors/sensor/<sensorId>
curl -H "Authorization: Bearer <token>" http://localhost:3000/iot/alerts/sensor/<sensorId>
```

**Paso 4 — Disparar la sincronización real:**
```bash
curl -X POST http://localhost:3000/iot/sync-patient/<pacienteId> \
  -H "Authorization: Bearer <token>"
```
Esperado: `{ success: true, processed: N }`.

**Paso 5 — Verificar en base de datos que quedó todo persistido:**
```sql
SELECT * FROM mediciones_clinicas WHERE paciente_id = '<pacienteId>' AND origen = 'IOT' ORDER BY created_at DESC;
SELECT * FROM alertas WHERE paciente_id = '<pacienteId>' AND tipo LIKE 'IOT_%' ORDER BY created_at DESC;
SELECT * FROM incidentes_salud WHERE paciente_id = '<pacienteId>' AND tipo = 'FALLA_CONEXION' ORDER BY created_at DESC;
```

**Paso 6 — Caso crítico (opcional, requiere que el Grupo 8 arme a propósito una alerta
`CRITICAL`/`HIGH` para el sensor de prueba)**: repetir el Paso 4 y confirmar que además de la
alerta aparece un incidente en `incidentes_salud` con `severidad = 'CRITICA'`.

**Limpieza tras la prueba:**
```sql
DELETE FROM paciente_sensores WHERE asset_id = '<assetId>' AND sensor_id = '<sensorId>';
```
