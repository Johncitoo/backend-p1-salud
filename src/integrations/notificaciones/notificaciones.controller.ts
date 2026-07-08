import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { DevAuthGuard } from '../../auth/guards/dev-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { NotificacionesService } from './notificaciones.service';

@Controller('notificaciones-enviadas')
@UseGuards(DevAuthGuard, RolesGuard)
export class NotificacionesController {
  constructor(private readonly service: NotificacionesService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(@Query('visitaId') visitaId?: string, @Query('pacienteId') pacienteId?: string) {
    return this.service.findEnviadas({ visitaId, pacienteId });
  }

  @Get(':id/tracking')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  refrescarTracking(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.refrescarTracking(id);
  }
}
