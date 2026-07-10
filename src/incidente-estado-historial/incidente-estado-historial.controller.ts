import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { IncidenteEstadoHistorialService } from './incidente-estado-historial.service';
import { CreateIncidenteEstadoHistorialDto } from './dto/create-incidente-estado-historial.dto';

@Controller('incidente-estado-historial')
@UseGuards(DevAuthGuard, RolesGuard)
export class IncidenteEstadoHistorialController {
  constructor(
    private readonly incidenteEstadoHistorialService: IncidenteEstadoHistorialService,
  ) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(@Query('incidenteSaludId') incidenteSaludId?: string) {
    return this.incidenteEstadoHistorialService.findAll({ incidenteSaludId });
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.incidenteEstadoHistorialService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR')
  create(@Body() dto: CreateIncidenteEstadoHistorialDto, @Request() req: any) {
    return this.incidenteEstadoHistorialService.create(dto, req.user?.id);
  }
}
