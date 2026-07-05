import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { IncidentesSaludService } from './incidentes-salud.service';
import { CreateIncidenteSaludDto } from './dto/create-incidente-salud.dto';
import { UpdateIncidenteSaludDto } from './dto/update-incidente-salud.dto';

@Controller('incidentes-salud')
export class IncidentesSaludController {
  constructor(private readonly incidentesSaludService: IncidentesSaludService) {}

  @Get('externo/:id')
  @UseGuards(ApiKeyGuard)
  async findOneExterno(@Param('id') id: string) {
    const incidente = await this.incidentesSaludService.findOne(id);
    return {
      id: incidente.id,
      titulo: incidente.titulo,
      descripcion: incidente.descripcion,
      estado: incidente.estado,
      severidad: incidente.severidad,
    };
  }

  @Get()
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(
    @Query('estado') estado?: string,
    @Query('severidad') severidad?: string,
    @Query('pacienteId') pacienteId?: string,
    @Query('visitaId') visitaId?: string,
  ) {
    return this.incidentesSaludService.findAll({
      estado,
      severidad,
      pacienteId,
      visitaId,
    });
  }

  @Get(':id')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.incidentesSaludService.findOne(id);
  }

  @Post()
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN', 'COORDINADOR')
  create(@Body() dto: CreateIncidenteSaludDto, @Request() req: any) {
    return this.incidentesSaludService.create(dto, req.user?.id);
  }

  @Patch(':id')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN', 'COORDINADOR')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIncidenteSaludDto,
    @Request() req: any,
  ) {
    return this.incidentesSaludService.update(id, dto, req.user?.id);
  }

  @Delete(':id')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.incidentesSaludService.remove(id, req.user?.id);
  }
}
