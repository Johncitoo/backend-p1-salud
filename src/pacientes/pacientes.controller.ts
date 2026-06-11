import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreatePacienteDto } from './dto/create-paciente.dto';
import { UpdatePacienteDto } from './dto/update-paciente.dto';
import { PacientesService } from './pacientes.service';
import { CreateDireccionDto } from './dto/create-direccion.dto';
import { UpdateDireccionDto } from './dto/update-direccion.dto';
import { CreateContactoDto } from './dto/create-contacto.dto';
import { UpdateContactoDto } from './dto/update-contacto.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreateVisitaDto } from './dto/create-visita.dto';
import { UpdateVisitaDto } from './dto/update-visita.dto';

@Controller('pacientes')
@UseGuards(DevAuthGuard, RolesGuard)
export class PacientesController {
  constructor(private readonly pacientesService: PacientesService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll() {
    return this.pacientesService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.pacientesService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  create(@Body() dto: CreatePacienteDto) {
    return this.pacientesService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'COORDINADOR')
  update(@Param('id') id: string, @Body() dto: UpdatePacienteDto) {
    return this.pacientesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.pacientesService.remove(id);
  }

  /* Direcciones */
  @Get(':pacienteId/direcciones')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findDirecciones(@Param('pacienteId', ParseUUIDPipe) pacienteId: string) {
    return this.pacientesService.findDirecciones(pacienteId);
  }

  @Post(':pacienteId/direcciones')
  @Roles('ADMIN', 'COORDINADOR')
  createDireccion(
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dto: CreateDireccionDto,
  ) {
    dto.pacienteId = pacienteId;
    return this.pacientesService.createDireccion(dto);
  }

  @Patch('direcciones/:id')
  @Roles('ADMIN', 'COORDINADOR')
  updateDireccion(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDireccionDto) {
    return this.pacientesService.updateDireccion(id, dto);
  }

  @Delete('direcciones/:id')
  @Roles('ADMIN')
  removeDireccion(@Param('id', ParseUUIDPipe) id: string) {
    return this.pacientesService.removeDireccion(id);
  }

  /* Contactos */
  @Get(':pacienteId/contactos')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findContactos(@Param('pacienteId', ParseUUIDPipe) pacienteId: string) {
    return this.pacientesService.findContactos(pacienteId);
  }

  @Post(':pacienteId/contactos')
  @Roles('ADMIN', 'COORDINADOR')
  createContacto(@Param('pacienteId', ParseUUIDPipe) pacienteId: string, @Body() dto: CreateContactoDto) {
    dto.pacienteId = pacienteId;
    return this.pacientesService.createContacto(dto);
  }

  @Patch('contactos/:id')
  @Roles('ADMIN', 'COORDINADOR')
  updateContacto(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContactoDto) {
    return this.pacientesService.updateContacto(id, dto);
  }

  @Delete('contactos/:id')
  @Roles('ADMIN')
  removeContacto(@Param('id', ParseUUIDPipe) id: string) {
    return this.pacientesService.removeContacto(id);
  }

  /* Planes */
  @Get(':pacienteId/planes')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findPlanes(@Param('pacienteId', ParseUUIDPipe) pacienteId: string) {
    return this.pacientesService.findPlanes(pacienteId);
  }

  @Post(':pacienteId/planes')
  @Roles('ADMIN', 'COORDINADOR')
  createPlan(@Param('pacienteId', ParseUUIDPipe) pacienteId: string, @Body() dto: CreatePlanDto) {
    dto.pacienteId = pacienteId;
    return this.pacientesService.createPlan(dto);
  }

  @Patch('planes/:id')
  @Roles('ADMIN', 'COORDINADOR')
  updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.pacientesService.updatePlan(id, dto);
  }

  @Delete('planes/:id')
  @Roles('ADMIN')
  removePlan(@Param('id', ParseUUIDPipe) id: string) {
    return this.pacientesService.removePlan(id);
  }

  /* Visitas */
  @Get(':pacienteId/visitas')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findVisitas(@Param('pacienteId', ParseUUIDPipe) pacienteId: string) {
    return this.pacientesService.findVisitas(pacienteId);
  }

  @Post(':pacienteId/visitas')
  @Roles('ADMIN', 'COORDINADOR')
  createVisita(@Param('pacienteId', ParseUUIDPipe) pacienteId: string, @Body() dto: CreateVisitaDto) {
    dto.pacienteId = pacienteId;
    return this.pacientesService.createVisita(dto);
  }

  @Patch('visitas/:id')
  @Roles('ADMIN', 'COORDINADOR')
  updateVisita(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVisitaDto) {
    return this.pacientesService.updateVisita(id, dto);
  }

  @Delete('visitas/:id')
  @Roles('ADMIN')
  removeVisita(@Param('id', ParseUUIDPipe) id: string) {
    return this.pacientesService.removeVisita(id);
  }
}
