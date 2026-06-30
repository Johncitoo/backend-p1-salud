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
guardarían en `mediciones_clinicas` con `origen = 'SENSOR'`.

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
| `src/integrations/iot/iot.service.ts` | Cliente HTTP + mapeo de telemetría |
| `src/integrations/iot/iot.module.ts` | Módulo NestJS |
| `src/integrations/iot/iot.controller.ts` | Endpoints proxy para el frontend |
| `src/app.module.ts` | Registro del IoTModule |

## Pendiente / futuro

1. **Vincular sensores a pacientes**: Crear tabla `sensores_paciente` que mapee
   `sensorId` del Grupo 8 a `paciente_id` de nuestra BD. Esto permite saber
   automáticamente a qué paciente corresponde cada lectura.

2. **Guardar mediciones automáticamente**: Usar `extractMediciones()` para convertir
   lecturas IoT en registros de `mediciones_clinicas` con `origen = 'SENSOR'`.
   Puede ser bajo demanda (al abrir ficha del paciente) o periódico (cron).

3. **Generar alertas clínicas**: Si un valor está fuera de rango (ej: saturación < 90%),
   crear una alerta en la tabla `alertas` y notificar al Grupo 9 (`alerta_upsert`).

4. **Confirmar con el Grupo 8**:
   - ¿Cómo vinculamos `assetId`/`sensorId` con nuestros pacientes?
   - ¿Nos avisan por Kafka/webhook o debemos hacer polling?
   - ¿Los sensorId son estables o cambian?
