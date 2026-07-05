import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IoTService } from './iot.service';

@Injectable()
export class IoTCronService {
  private readonly logger = new Logger(IoTCronService.name);
  
  // Memoria temporal para no insertar duplicados.
  // Guardamos la fecha del último dato procesado por cada sensor (sensorId).
  private lastSyncPerSensor = new Map<string, Date>();
  // Guardamos la fecha de la última alerta procesada por sensor
  private lastAlertPerSensor = new Map<string, Date>();

  constructor(private readonly iotService: IoTService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleIoTTelemetrySync() {
    this.logger.log('Iniciando sincronización automática (Pull) de telemetría IoT...');
    
    try {
      // 1. Obtener todos los sensores vinculados y activos en nuestra base de datos
      // Asumimos que los pacientes activos tienen sensores. Para simplificar,
      // podríamos traer todos los sensores de la BD o simplemente traer toda la lectura
      // y cruzarla con la BD durante el processTelemetryWebhook (que ya verifica si existe el sensor).
      
      // 2. Traer TODAS las lecturas del equipo 08
      const allReadings = await this.iotService.getAllReadings();
      
      if (!allReadings || allReadings.length === 0) {
        this.logger.log('No se encontraron lecturas en la plataforma IoT.');
        return;
      }

      let processedCount = 0;
      
      // Ordenamos las lecturas por fecha ascendente para procesar de más viejo a más nuevo
      // Esto asegura que el lastSyncPerSensor siempre quede con la fecha más reciente
      const sortedReadings = [...allReadings].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      });

      for (const reading of sortedReadings) {
        if (!reading.createdAt) continue;
        
        const readingDate = new Date(reading.createdAt);
        const lastSync = this.lastSyncPerSensor.get(reading.sensorId) || new Date(0);

        // Si la lectura es más reciente que nuestra última sincronización para este sensor
        if (readingDate > lastSync) {
          // Intentamos procesarla (el servicio internamente verificará si el assetId/sensorId está vinculado)
          await this.iotService.processTelemetryWebhook(reading);
          
          // Actualizamos la memoria
          this.lastSyncPerSensor.set(reading.sensorId, readingDate);
          processedCount++;
        }
      }

      this.logger.log(`Sincronización de telemetría finalizada. Se insertaron ${processedCount} nuevos registros.`);
    } catch (error) {
      this.logger.error(`Error en sincronización de telemetría: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleIoTAlertsSync() {
    this.logger.log('Iniciando sincronización automática (Pull) de alertas IoT...');
    
    try {
      const allAlerts = await this.iotService.getAllAlerts();
      
      if (!allAlerts || allAlerts.length === 0) {
        return; // Sin logs para no ensuciar tanto la consola
      }

      let processedCount = 0;
      
      const sortedAlerts = [...allAlerts].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      });

      for (const alert of sortedAlerts) {
        if (!alert.createdAt) continue;
        
        const alertDate = new Date(alert.createdAt);
        const lastSync = this.lastAlertPerSensor.get(alert.sensorId) || new Date(0);

        if (alertDate > lastSync) {
          await this.iotService.processAlertWebhook(alert);
          this.lastAlertPerSensor.set(alert.sensorId, alertDate);
          processedCount++;
        }
      }

      if (processedCount > 0) {
        this.logger.log(`Sincronización de alertas finalizada. Se crearon ${processedCount} nuevas alertas.`);
      }
    } catch (error) {
      this.logger.error(`Error en sincronización de alertas: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
