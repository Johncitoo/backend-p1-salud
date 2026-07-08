import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PacienteSensor } from './entities/paciente-sensor.entity';
import { MedicionesClinicasService } from '../../mediciones-clinicas/mediciones-clinicas.service';
import { VariablesClinicasService } from '../../variables-clinicas/variables-clinicas.service';
import { AlertasService } from '../../alertas/alertas.service';
import { IncidentesSaludService } from '../../incidentes-salud/incidentes-salud.service';

// =========================================================
// Integración con Grupo 8 (Plataforma IoT - Sensores médicos)
// Consumimos su API para obtener telemetría y alertas de sensores
// asignados a pacientes.
// =========================================================

// Tipos de sensores que maneja el Grupo 8
type SensorType = 'thermometer' | 'glucometer' | 'pulse_oximeter' | 'sphygmomanometer';

// Lectura de telemetría del Grupo 8
export type IoTTelemetryReading = {
  sensorId: string;
  assetId: string;
  sensorType: SensorType;
  batteryLevel: number;
  connectionStatus: string;
  temperature?: number;
  glucoseLevel?: number;
  oxygenSaturation?: number;
  heartRate?: number;
  systolicPressure?: number;
  diastolicPressure?: number;
  createdAt?: string;
};

// Alerta del Grupo 8
export type IoTAlert = {
  sensorId: string;
  type: string;
  severity: string;
  message: string;
  resolved: boolean;
  createdAt?: string;
};

// Estado de salud de la plataforma IoT
export type IoTHealthStatus = {
  status: string;
  service: string;
  database: string;
  kafka?: { connected: boolean; broker?: string };
  timestamp: string;
};

// Dispositivo del catálogo del Grupo 8 (GET /sensors/devices): un sensor
// distinto que ya tiene al menos una lectura. Sirve para elegir qué vincular
// a un paciente sin escribir los IDs a mano.
export type IoTDevice = {
  sensorId: string;
  assetId: string;
  sensorType: SensorType;
  batteryLevel?: number;
  connectionStatus?: string;
  lastReadingAt?: string;
};

// Respuesta paginada del catálogo de dispositivos.
export type IoTDeviceCatalog = {
  data: IoTDevice[];
  page: number;
  limit: number;
  total: number;
};

// Filtros/paginación aceptados por GET /sensors/devices.
export type IoTDeviceCatalogParams = {
  page?: number;
  limit?: number;
  sensorType?: string;
  search?: string;
};

// Mapeo de campos de telemetría a nuestras variables clínicas
export const IOT_VARIABLE_MAP: Record<string, string> = {
  oxygenSaturation: 'saturacion_oxigeno',
  heartRate: 'frecuencia_cardiaca',
  systolicPressure: 'presion_arterial_sistolica',
  diastolicPressure: 'presion_arterial_diastolica',
  temperature: 'temperatura',
  glucoseLevel: 'glicemia_capilar',
};

// Tipos de alerta que representan un problema CLÍNICO del paciente (signo vital
// fuera de rango). El resto (low_battery, sensor_offline) son problemas TÉCNICOS
// del dispositivo. Clasificamos por tipo y NO por el campo `severity` del Grupo 8,
// porque ellos marcan como "critical" cosas técnicas (batería, desconexión) y como
// "warning" los signos vitales fuera de rango — al revés de lo que importa clínicamente.
export const CLINICAL_ALERT_TYPES = new Set<string>([
  'oxygen_saturation_low',
  'blood_pressure_high',
  'glucose_out_of_range',
  'temperature_out_of_range',
]);

// Kit portátil simulado por el Grupo 8: un único asset ("PATIENT-001") con 3
// sensores que el profesional "reclama" para el paciente que está atendiendo
// en ese momento (assetId+sensorId es único por diseño en PacienteSensor, así
// que no puede estar asignado a varios pacientes a la vez — se reasigna en
// cada visita, igual que un tensiómetro físico portátil que se comparte).
export const PORTABLE_KIT_SENSORS: Array<{ sensorId: string; assetId: string; sensorType: SensorType }> = [
  { sensorId: 'GLUCO-001', assetId: 'PATIENT-001', sensorType: 'glucometer' },
  { sensorId: 'OXI-001', assetId: 'PATIENT-001', sensorType: 'pulse_oximeter' },
  { sensorId: 'BP-001', assetId: 'PATIENT-001', sensorType: 'sphygmomanometer' },
];

@Injectable()
export class IoTService {
  private readonly logger = new Logger(IoTService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(PacienteSensor)
    private readonly pacienteSensorRepo: Repository<PacienteSensor>,
    private readonly medicionesClinicasService: MedicionesClinicasService,
    private readonly variablesClinicasService: VariablesClinicasService,
    private readonly alertasService: AlertasService,
    private readonly incidentesSaludService: IncidentesSaludService,
  ) {}

  // =========================================================
  // Configuración
  // =========================================================

  private getBaseUrl(): string {
    return (this.configService.get<string>('IOT_API_URL') ?? '').trim();
  }

  private isEnabled(): boolean {
    return this.configService.get<string>('IOT_ENABLED') === 'true';
  }

  // =========================================================
  // Cliente HTTP genérico (GET)
  // =========================================================

  private async fetchFromIoT<T>(path: string): Promise<T | null> {
    const baseUrl = this.getBaseUrl();

    if (!this.isEnabled()) {
      this.logger.log(`[IoT mock] GET ${path}`);
      return null;
    }

    if (!baseUrl) {
      this.logger.warn(`IOT_ENABLED=true pero IOT_API_URL está vacío. Petición no realizada: GET ${path}`);
      return null;
    }

    const endpoint = `${baseUrl}${path}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        this.logger.error(`IoT API respondió HTTP ${response.status} en GET ${path}`);
        return null;
      }

      return await response.json() as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo conectar con IoT API: ${message}`);
      return null;
    }
  }

  // La API del Grupo 8 devuelve las listas envueltas en { data, page, limit, total }
  // (confirmado contra su API real), a diferencia de /sensors/latest que devuelve
  // el objeto plano. Desenvolvemos aqui para no filtrar ese detalle al resto del servicio.
  private async fetchListFromIoT<T>(path: string): Promise<T[] | null> {
    const response = await this.fetchFromIoT<{ data: T[] } | T[]>(path);
    if (!response) return null;
    return Array.isArray(response) ? response : (response.data ?? null);
  }

  // =========================================================
  // Endpoints del Grupo 8
  // =========================================================

  async getHealthStatus(): Promise<IoTHealthStatus | null> {
    return this.fetchFromIoT<IoTHealthStatus>('/health');
  }

  async getAllReadings(): Promise<IoTTelemetryReading[] | null> {
    return this.fetchListFromIoT<IoTTelemetryReading>('/sensors');
  }

  async getLatestReading(): Promise<IoTTelemetryReading | null> {
    return this.fetchFromIoT<IoTTelemetryReading>('/sensors/latest');
  }

  async getReadingsBySensor(sensorId: string, limit?: number): Promise<IoTTelemetryReading[] | null> {
    const query = limit ? `?limit=${limit}` : '';
    return this.fetchListFromIoT<IoTTelemetryReading>(`/sensors/sensor/${sensorId}${query}`);
  }

  async getAllAlerts(): Promise<IoTAlert[] | null> {
    return this.fetchListFromIoT<IoTAlert>('/alerts');
  }

  async getAlertsBySensor(sensorId: string, limit?: number): Promise<IoTAlert[] | null> {
    const query = limit ? `?limit=${limit}` : '';
    return this.fetchListFromIoT<IoTAlert>(`/alerts/sensor/${sensorId}${query}`);
  }

  // Catálogo de dispositivos disponibles para vincular a un paciente. A
  // diferencia de los otros métodos de lista, aquí devolvemos la respuesta
  // paginada completa (data + page/limit/total) porque el frontend necesita
  // esa metadata para paginar y buscar.
  async getDeviceCatalog(params: IoTDeviceCatalogParams = {}): Promise<IoTDeviceCatalog | null> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.sensorType) query.set('sensorType', params.sensorType);
    if (params.search) query.set('search', params.search);

    const qs = query.toString();
    return this.fetchFromIoT<IoTDeviceCatalog>(`/sensors/devices${qs ? `?${qs}` : ''}`);
  }

  // =========================================================
  // Mapeo de telemetría a mediciones clínicas
  // Extrae los valores numéricos de una lectura IoT y los
  // devuelve como pares { codigoVariable, valor } listos para
  // guardar en mediciones_clinicas.
  // =========================================================

  extractMediciones(reading: IoTTelemetryReading): Array<{ codigoVariable: string; valor: number }> {
    const mediciones: Array<{ codigoVariable: string; valor: number }> = [];

    for (const [iotField, variableCodigo] of Object.entries(IOT_VARIABLE_MAP)) {
      const value = reading[iotField as keyof IoTTelemetryReading];
      if (typeof value === 'number' && !Number.isNaN(value)) {
        mediciones.push({ codigoVariable: variableCodigo, valor: value });
      }
    }

    return mediciones;
  }

  // =========================================================
  // Procesamiento de Lecturas (Polling)
  // =========================================================

  async processTelemetryReading(reading: IoTTelemetryReading): Promise<void> {
    try {
      const pacienteSensor = await this.pacienteSensorRepo.findOne({
        where: { assetId: reading.assetId, isActive: true },
        relations: ['paciente']
      });

      if (!pacienteSensor) {
        this.logger.warn(`No se encontró paciente activo para assetId: ${reading.assetId}`);
        return;
      }

      const mediciones = this.extractMediciones(reading);

      for (const med of mediciones) {
        const variable = await this.variablesClinicasService.findByCodigo(med.codigoVariable);
        if (!variable) {
          this.logger.warn(`Variable clínica no encontrada: ${med.codigoVariable}`);
          continue;
        }

        const fechaMedicion = reading.createdAt ? new Date(reading.createdAt) : new Date();

        // Evitar duplicados revisando si ya existe un registro con la misma fecha
        if (reading.createdAt) {
          const existentes = await this.medicionesClinicasService.findAll({
            pacienteId: pacienteSensor.pacienteId,
            variableClinicaId: variable.id,
            origen: 'IOT',
            fechaDesde: fechaMedicion.toISOString(),
            fechaHasta: fechaMedicion.toISOString()
          });

          if (existentes && existentes.length > 0) {
            continue; // Ya existe esta medición exacta
          }
        }

        await this.medicionesClinicasService.create({
          pacienteId: pacienteSensor.pacienteId,
          variableClinicaId: variable.id,
          valorNumero: med.valor,
          origen: 'IOT',
          fechaMedicion: fechaMedicion,
        });
      }
      this.logger.log(`Procesadas ${mediciones.length} mediciones para assetId: ${reading.assetId}`);
    } catch (error) {
      this.logger.error(`Error procesando telemetría: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async processAlertReading(alert: IoTAlert): Promise<void> {
    try {
      // Intentamos buscar el assetId si viene embebido, o buscamos por sensorId
      // El equipo 8 dice que el sensorId es "OXI-001" pero también hay un assetId.
      // Si la alerta solo trae sensorId, buscamos por sensorId
      const pacienteSensor = await this.pacienteSensorRepo.findOne({
        where: { sensorId: alert.sensorId, isActive: true }
      });

      if (!pacienteSensor) {
        this.logger.warn(`No se encontró paciente para alerta de sensorId: ${alert.sensorId}`);
        return;
      }

      // Criticidad en dos dimensiones (matriz 2x2):
      //  - Categoría por TIPO: clínica (signo vital) vs técnica (dispositivo).
      //  - Severidad de Grupo 8 (warning/critical): la respetamos como modulador
      //    DENTRO de cada categoría, porque su señal sí sirve para medir qué tan
      //    degradado está el dispositivo o la lectura.
      //
      //                    | warning | critical
      //   Clínica          |  ALTA   | CRITICA
      //   Técnica          |  BAJA   | MEDIA
      //
      // Así lo clínico siempre pesa más que lo técnico al mismo nivel de Grupo 8.
      const esClinica = CLINICAL_ALERT_TYPES.has(alert.type);
      const severityG8 = (alert.severity ?? '').toLowerCase();
      const esCriticaG8 = severityG8 === 'critical' || severityG8 === 'high';

      let nivel: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
      let tipoIncidente: string;
      let titulo: string;

      if (esClinica) {
        nivel = esCriticaG8 ? 'CRITICA' : 'ALTA';
        tipoIncidente = 'SIGNO_VITAL_ANORMAL';
        titulo = `Signo vital fuera de rango (${alert.type})`;
      } else if (alert.type === 'sensor_offline') {
        nivel = esCriticaG8 ? 'MEDIA' : 'BAJA';
        tipoIncidente = 'FALLA_SENSOR';
        titulo = `Sensor IoT desconectado (${alert.sensorId})`;
      } else {
        // low_battery u otro evento técnico
        nivel = esCriticaG8 ? 'MEDIA' : 'BAJA';
        tipoIncidente = 'FALLA_DISPOSITIVO';
        titulo = `Falla técnica de sensor IoT (${alert.type})`;
      }

      // Deduplicación: evita re-crear la misma alerta/incidente en cada sync.
      const existentes = await this.alertasService.findAll({ pacienteId: pacienteSensor.pacienteId });
      const duplicate = existentes.find(a =>
        a.mensaje === alert.message &&
        a.tipo === `IOT_${alert.type.toUpperCase()}`
      );
      if (duplicate) {
        return; // Evitar duplicar alertas idénticas
      }

      await this.alertasService.create({
        pacienteId: pacienteSensor.pacienteId,
        tipo: `IOT_${alert.type.toUpperCase()}`,
        mensaje: alert.message,
        prioridad: nivel,
      });
      this.logger.log(`Alerta IoT (${alert.type}, ${nivel}) creada para paciente ${pacienteSensor.pacienteId}`);

      // Toda alerta genera un incidente (clínico o técnico) para dejar registro
      // ordenado y escalarlo a Grupo 11 con la prioridad correspondiente. Guardamos
      // en metadata la señal cruda de Grupo 8 para auditoría (no se pierde).
      await this.incidentesSaludService.create({
        titulo,
        descripcion: alert.message,
        tipo: tipoIncidente,
        severidad: nivel,
        estado: 'ABIERTO',
        origen: 'SISTEMA',
        pacienteId: pacienteSensor.pacienteId,
        metadata: {
          fuente: 'IOT',
          sensorId: alert.sensorId,
          tipoAlerta: alert.type,
          severidadOrigen: alert.severity,
          categoria: esClinica ? 'CLINICA' : 'TECNICA',
        },
      });
    } catch (error) {
      this.logger.error(`Error procesando alerta: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // =========================================================
  // Gestión local de dispositivos
  // =========================================================

  async getSensorsByPatient(pacienteId: string): Promise<PacienteSensor[]> {
    return this.pacienteSensorRepo.find({
      where: { pacienteId, isActive: true },
      order: { createdAt: 'DESC' }
    });
  }

  async assignSensorToPatient(
    pacienteId: string,
    assetId: string,
    sensorId: string,
    sensorType: SensorType
  ): Promise<PacienteSensor> {
    // Buscar si ya existe la vinculación exacta inactiva y reactivarla, o crear nueva
    let sensor = await this.pacienteSensorRepo.findOne({
      where: { assetId, sensorId }
    });

    if (sensor) {
      sensor.pacienteId = pacienteId;
      sensor.sensorType = sensorType;
      sensor.isActive = true;
    } else {
      sensor = this.pacienteSensorRepo.create({
        pacienteId,
        assetId,
        sensorId,
        sensorType,
        isActive: true,
      });
    }

    return this.pacienteSensorRepo.save(sensor);
  }

  // =========================================================
  // Kit portátil (auto-llenado de signos vitales en la ficha)
  // =========================================================

  // Reclama el kit portátil (GLUCO-001/OXI-001/BP-001) para este paciente,
  // reasignando cada sensor si estaba en otro paciente. Se llama al hacer
  // check-in en una visita.
  async claimPortableKit(pacienteId: string): Promise<PacienteSensor[]> {
    const asignados: PacienteSensor[] = [];
    for (const s of PORTABLE_KIT_SENSORS) {
      const sensor = await this.assignSensorToPatient(pacienteId, s.assetId, s.sensorId, s.sensorType);
      asignados.push(sensor);
    }
    return asignados;
  }

  // Última lectura de cada sensor activo del paciente, mapeada a los códigos
  // de variable clínica (mismos nombres que IOT_VARIABLE_MAP) para que el
  // formulario de la ficha pueda auto-completarse directamente.
  //
  // Consultamos la última lectura de CADA sensor vinculado por separado
  // (getReadingsBySensor con limit=1), en vez de /sensors global: ese endpoint
  // solo trae las ~25 lecturas más recientes de toda la plataforma, y con
  // cientos de sensores simulados los del paciente podían no aparecer, dejando
  // los signos vitales vacíos.
  async getLatestVitalsForPatient(pacienteId: string): Promise<Record<string, number>> {
    const sensoresPaciente = await this.getSensorsByPatient(pacienteId);
    if (sensoresPaciente.length === 0) return {};

    const vitales: Record<string, number> = {};
    for (const sensor of sensoresPaciente) {
      const lecturas = await this.getReadingsBySensor(sensor.sensorId, 1);
      const lectura = lecturas?.[0];
      if (!lectura) continue;
      for (const [campoIot, valor] of Object.entries(this.extractMedicionesRaw(lectura))) {
        vitales[campoIot] = valor;
      }
    }
    return vitales;
  }

  // Igual que extractMediciones pero devuelve { codigoVariable: valor } en vez
  // de un array, para armar el objeto plano de getLatestVitalsForPatient.
  private extractMedicionesRaw(reading: IoTTelemetryReading): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [iotField, variableCodigo] of Object.entries(IOT_VARIABLE_MAP)) {
      const value = reading[iotField as keyof IoTTelemetryReading];
      if (typeof value === 'number' && !Number.isNaN(value)) {
        out[variableCodigo] = value;
      }
    }
    return out;
  }
}
