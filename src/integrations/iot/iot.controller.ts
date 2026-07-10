import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DevAuthGuard } from '../../auth/guards/dev-auth.guard';
import { IoTService } from './iot.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { IoTSyncService } from './iot-sync.service';

@Controller('iot')
@UseGuards(DevAuthGuard, RolesGuard)
export class IoTController {
  constructor(
    private readonly iotService: IoTService,
    private readonly iotSyncService: IoTSyncService,
  ) {}

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

  // Catálogo de dispositivos disponibles para vincular a un paciente (proxy a
  // GET /sensors/devices del Grupo 8). Acepta page/limit/sensorType/search.
  @Get('devices')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  getDeviceCatalog(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sensorType') sensorType?: string,
    @Query('search') search?: string,
  ) {
    return this.iotService.getDeviceCatalog({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sensorType,
      search,
    });
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

  // =========================================================
  // Gestión de Dispositivos Locales
  // =========================================================

  @Get('paciente-sensores/:pacienteId')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  getSensorsByPatient(@Param('pacienteId') pacienteId: string) {
    return this.iotService.getSensorsByPatient(pacienteId);
  }

  @Post('paciente-sensores')
  @Roles('ADMIN', 'COORDINADOR')
  assignSensorToPatient(
    @Body('pacienteId') pacienteId: string,
    @Body('assetId') assetId: string,
    @Body('sensorId') sensorId: string,
    @Body('sensorType') sensorType: any,
  ) {
    return this.iotService.assignSensorToPatient(
      pacienteId,
      assetId,
      sensorId,
      sensorType,
    );
  }

  @Post('sync-patient/:pacienteId')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  syncPatientIoTData(@Param('pacienteId') pacienteId: string) {
    return this.iotSyncService.syncForPatient(pacienteId);
  }

  // =========================================================
  // Kit portátil (auto-llenado de signos vitales en la ficha)
  // =========================================================

  @Post('paciente-sensores/:pacienteId/reclamar-kit')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  reclamarKitPortatil(@Param('pacienteId') pacienteId: string) {
    return this.iotService.claimPortableKit(pacienteId);
  }

  @Get('paciente-sensores/:pacienteId/signos-vitales')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  getSignosVitales(@Param('pacienteId') pacienteId: string) {
    return this.iotService.getLatestVitalsForPatient(pacienteId);
  }
}
