import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DevAuthGuard } from '../../auth/guards/dev-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { IoTService } from './iot.service';

@Controller('iot')
@UseGuards(DevAuthGuard, RolesGuard)
export class IoTController {
  constructor(private readonly iotService: IoTService) {}

  @Get('health')
  @Roles('ADMIN', 'COORDINADOR', 'SUPERVISOR')
  getHealth() {
    return this.iotService.getHealthStatus();
  }

  @Get('sensors')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  getAllReadings() {
    return this.iotService.getAllReadings();
  }

  @Get('sensors/latest')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  getLatestReading() {
    return this.iotService.getLatestReading();
  }

  @Get('sensors/:sensorId')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  getReadingsBySensor(@Param('sensorId') sensorId: string) {
    return this.iotService.getReadingsBySensor(sensorId);
  }

  @Get('alerts')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  getAllAlerts() {
    return this.iotService.getAllAlerts();
  }

  @Get('alerts/:sensorId')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  getAlertsBySensor(@Param('sensorId') sensorId: string) {
    return this.iotService.getAlertsBySensor(sensorId);
  }
}
