import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
} from '@nestjs/common';
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
export class PacientesController {
  constructor(private readonly pacientesService: PacientesService) {}

  @Get()
  findAll() {
    return this.pacientesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pacientesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePacienteDto) {
    return this.pacientesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePacienteDto) {
    return this.pacientesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pacientesService.remove(id);
  }

  /* Direcciones */
  @Get(':pacienteId/direcciones')
  findDirecciones(@Param('pacienteId', ParseUUIDPipe) pacienteId: string) {
    return this.pacientesService.findDirecciones(pacienteId);
  }

  @Post(':pacienteId/direcciones')
  createDireccion(
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dto: CreateDireccionDto,
  ) {
    dto.pacienteId = pacienteId;
    return this.pacientesService.createDireccion(dto);
  }

  @Patch('direcciones/:id')
  updateDireccion(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDireccionDto) {
    return this.pacientesService.updateDireccion(id, dto);
  }

  @Delete('direcciones/:id')
  removeDireccion(@Param('id', ParseUUIDPipe) id: string) {
    return this.pacientesService.removeDireccion(id);
  }

  /* Contactos */
  @Get(':pacienteId/contactos')
  findContactos(@Param('pacienteId', ParseUUIDPipe) pacienteId: string) {
    return this.pacientesService.findContactos(pacienteId);
  }

  @Post(':pacienteId/contactos')
  createContacto(@Param('pacienteId', ParseUUIDPipe) pacienteId: string, @Body() dto: CreateContactoDto) {
    dto.pacienteId = pacienteId;
    return this.pacientesService.createContacto(dto);
  }

  @Patch('contactos/:id')
  updateContacto(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContactoDto) {
    return this.pacientesService.updateContacto(id, dto);
  }

  @Delete('contactos/:id')
  removeContacto(@Param('id', ParseUUIDPipe) id: string) {
    return this.pacientesService.removeContacto(id);
  }

  /* Planes */
  @Get(':pacienteId/planes')
  findPlanes(@Param('pacienteId', ParseUUIDPipe) pacienteId: string) {
    return this.pacientesService.findPlanes(pacienteId);
  }

  @Post(':pacienteId/planes')
  createPlan(@Param('pacienteId', ParseUUIDPipe) pacienteId: string, @Body() dto: CreatePlanDto) {
    dto.pacienteId = pacienteId;
    return this.pacientesService.createPlan(dto);
  }

  @Patch('planes/:id')
  updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.pacientesService.updatePlan(id, dto);
  }

  @Delete('planes/:id')
  removePlan(@Param('id', ParseUUIDPipe) id: string) {
    return this.pacientesService.removePlan(id);
  }

  /* Visitas */
  @Get(':pacienteId/visitas')
  findVisitas(@Param('pacienteId', ParseUUIDPipe) pacienteId: string) {
    return this.pacientesService.findVisitas(pacienteId);
  }

  @Post(':pacienteId/visitas')
  createVisita(@Param('pacienteId', ParseUUIDPipe) pacienteId: string, @Body() dto: CreateVisitaDto) {
    dto.pacienteId = pacienteId;
    return this.pacientesService.createVisita(dto);
  }

  @Patch('visitas/:id')
  updateVisita(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVisitaDto) {
    return this.pacientesService.updateVisita(id, dto);
  }

  @Delete('visitas/:id')
  removeVisita(@Param('id', ParseUUIDPipe) id: string) {
    return this.pacientesService.removeVisita(id);
  }
}
