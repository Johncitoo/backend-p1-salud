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
import { Throttle } from '@nestjs/throttler';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { IncidentesSaludService } from './incidentes-salud.service';
import { CreateIncidenteSaludDto } from './dto/create-incidente-salud.dto';
import { UpdateIncidenteSaludDto } from './dto/update-incidente-salud.dto';
import { PacientesService } from '../pacientes/pacientes.service';
import { Paciente } from '../pacientes/entities/paciente.entity';

@Controller('incidentes-salud')
export class IncidentesSaludController {
  constructor(
    private readonly incidentesSaludService: IncidentesSaludService,
    private readonly pacientesService: PacientesService,
  ) {}

  @Get('externo/:id')
  @UseGuards(ApiKeyGuard)
  // Límite estricto: sin esto, la API key se podía probar por fuerza bruta
  // sin ningún freno (este endpoint además expone PII de pacientes).
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async findOneExterno(@Param('id') id: string) {
    const incidente = await this.incidentesSaludService.findOne(id);
    let paciente: Paciente | null = null;
    
    if (incidente.pacienteId) {
      paciente = await this.pacientesService.findOne(incidente.pacienteId).catch(() => null);
    }
    
    const { visita, profesional, profesionalUsuario } = await this.incidentesSaludService.getContextInfo(incidente);
    
    return {
      id: incidente.id,
      titulo: incidente.titulo,
      descripcion: incidente.descripcion,
      estado: incidente.estado,
      severidad: incidente.severidad,
      tipo: incidente.tipo,
      origen: incidente.origen,
      createdAt: incidente.createdAt,
      pacienteId: incidente.pacienteId,
      paciente: paciente ? {
        id: paciente.id,
        rut: paciente.rut,
        nombres: paciente.nombres,
        apellidos: paciente.apellidos,
        email: paciente.email,
        telefono: paciente.telefono,
        fechaNacimiento: paciente.fechaNacimiento,
        sexo: paciente.sexo,
        direccion: paciente.direccion,
      } : null,
      visitaId: incidente.visitaId,
      visita: visita ? {
        id: visita.id,
        fechaProgramada: visita.fechaProgramada,
        horaProgramada: visita.horaProgramada,
        estado: visita.estado,
        duracionEstimadaMin: visita.duracionEstimadaMin,
        checkInAt: visita.checkInAt,
        checkOutAt: visita.checkOutAt,
        prioridad: visita.prioridad,
      } : null,
      profesionalSaludId: incidente.profesionalSaludId,
      profesionalSalud: profesional ? {
        id: profesional.id,
        profesion: profesional.profesion,
        numeroRegistro: profesional.numeroRegistro,
        nombres: profesionalUsuario?.nombres,
        apellidos: profesionalUsuario?.apellidos,
        email: profesionalUsuario?.email,
      } : null,
    };
  }

  @Get(':id/crm')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('ADMIN', 'COORDINADOR', 'SUPERVISOR')
  findCrmStatus(@Param('id') id: string) {
    return this.incidentesSaludService.findCrmStatus(id);
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
    // Alta MANUAL desde la web: marcamos origen WEB por defecto para que el flujo
    // sí genere un ticket en CRM (CrmService.debeEnviarTicket filtra por origen).
    return this.incidentesSaludService.create(
      { ...dto, origen: dto.origen ?? 'WEB' },
      req.user?.id,
    );
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
