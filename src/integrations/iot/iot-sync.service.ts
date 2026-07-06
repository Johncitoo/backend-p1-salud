import { Injectable, Logger } from '@nestjs/common';
import { IoTService } from './iot.service';

@Injectable()
export class IoTSyncService {
  private readonly logger = new Logger(IoTSyncService.name);

  constructor(private readonly iotService: IoTService) {}

  /**
   * Sincroniza manualmente la telemetría y alertas para un paciente específico
   * consultando el historial de sus sensores vinculados.
   */
  async syncForPatient(pacienteId: string) {
    this.logger.log(`Iniciando sincronización manual (Pull) para paciente: ${pacienteId}`);
    
    try {
      const activeSensors = await this.iotService.getSensorsByPatient(pacienteId);
      
      if (!activeSensors || activeSensors.length === 0) {
        this.logger.log(`El paciente ${pacienteId} no tiene sensores activos para sincronizar.`);
        return { success: true, processed: 0, message: 'No hay sensores activos' };
      }

      let processedCount = 0;

      for (const sensor of activeSensors) {
        // 1. Obtener Historial de Telemetría para el sensor específico
        const readings = await this.iotService.getReadingsBySensor(sensor.sensorId);
        
        if (readings && readings.length > 0) {
          for (const reading of readings) {
            // El IoTService se encargará de ignorar duplicados gracias a la validación en processTelemetryWebhook
            await this.iotService.processTelemetryWebhook(reading);
            processedCount++;
          }
        }

        // 2. Obtener Alertas para el sensor específico
        const alerts = await this.iotService.getAlertsBySensor(sensor.sensorId);
        if (alerts && alerts.length > 0) {
          for (const alert of alerts) {
            await this.iotService.processAlertWebhook(alert);
            processedCount++; // Sumamos también las alertas procesadas
          }
        }
      }

      this.logger.log(`Sincronización finalizada para paciente ${pacienteId}. Registros escaneados/procesados: ${processedCount}.`);
      return { success: true, processed: processedCount };
    } catch (error) {
      this.logger.error(`Error en sincronización de paciente ${pacienteId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
