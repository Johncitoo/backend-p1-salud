import { Controller, Post, Body, HttpCode, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { IoTService } from './iot.service';
import { IoTTelemetryReading, IoTAlert } from './iot.service';

@Controller('iot/webhook')
export class IoTWebhookController {
  private readonly logger = new Logger(IoTWebhookController.name);

  constructor(private readonly iotService: IoTService) {}

  @Post('telemetry')
  @HttpCode(HttpStatus.OK)
  async handleTelemetry(@Body() payload: IoTTelemetryReading | IoTTelemetryReading[]) {
    this.logger.log(`Recibida telemetria vía webhook`);
    const readings = Array.isArray(payload) ? payload : [payload];
    
    for (const reading of readings) {
      await this.iotService.processTelemetryWebhook(reading);
    }
    return { success: true, processed: readings.length };
  }

  @Post('alerts')
  @HttpCode(HttpStatus.OK)
  async handleAlerts(@Body() payload: IoTAlert | IoTAlert[]) {
    this.logger.log(`Recibida alerta vía webhook`);
    const alerts = Array.isArray(payload) ? payload : [payload];
    
    for (const alert of alerts) {
      await this.iotService.processAlertWebhook(alert);
    }
    return { success: true, processed: alerts.length };
  }
}
