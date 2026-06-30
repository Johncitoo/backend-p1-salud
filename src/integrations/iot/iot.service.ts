import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

// Mapeo de campos de telemetría a nuestras variables clínicas
export const IOT_VARIABLE_MAP: Record<string, string> = {
  oxygenSaturation: 'saturacion_oxigeno',
  heartRate: 'frecuencia_cardiaca',
  systolicPressure: 'presion_arterial_sistolica',
  diastolicPressure: 'presion_arterial_diastolica',
  temperature: 'temperatura',
  glucoseLevel: 'glicemia_capilar',
};

@Injectable()
export class IoTService {
  private readonly logger = new Logger(IoTService.name);

  constructor(private readonly configService: ConfigService) {}

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

  // =========================================================
  // Endpoints del Grupo 8
  // =========================================================

  async getHealthStatus(): Promise<IoTHealthStatus | null> {
    return this.fetchFromIoT<IoTHealthStatus>('/health');
  }

  async getAllReadings(): Promise<IoTTelemetryReading[] | null> {
    return this.fetchFromIoT<IoTTelemetryReading[]>('/sensors');
  }

  async getLatestReading(): Promise<IoTTelemetryReading | null> {
    return this.fetchFromIoT<IoTTelemetryReading>('/sensors/latest');
  }

  async getReadingsBySensor(sensorId: string): Promise<IoTTelemetryReading[] | null> {
    return this.fetchFromIoT<IoTTelemetryReading[]>(`/sensors/sensor/${sensorId}`);
  }

  async getAllAlerts(): Promise<IoTAlert[] | null> {
    return this.fetchFromIoT<IoTAlert[]>('/alerts');
  }

  async getAlertsBySensor(sensorId: string): Promise<IoTAlert[] | null> {
    return this.fetchFromIoT<IoTAlert[]>(`/alerts/sensor/${sensorId}`);
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
}
