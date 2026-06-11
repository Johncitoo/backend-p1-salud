import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AsignarProfesionalDto } from './dto/asignar-profesional.dto';
import { CreateEspecialidadDto } from './dto/create-especialidad.dto';
import { CreateProfesionalDto } from './dto/create-profesional.dto';
import { UpdateEspecialidadDto } from './dto/update-especialidad.dto';
import { UpdateProfesionalDto } from './dto/update-profesional.dto';
import { ProfesionalesService } from './profesionales.service';

@Controller('profesionales')
@UseGuards(DevAuthGuard, RolesGuard)
export class ProfesionalesController {
  constructor(private readonly service: ProfesionalesService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll() { return this.service.findAll(); }

  @Get('especialidades')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findEspecialidades() { return this.service.findEspecialidades(); }

  @Get('usuarios-disponibles')
  @Roles('ADMIN', 'COORDINADOR', 'SUPERVISOR')
  findUsuariosDisponibles() { return this.service.findUsuariosDisponibles(); }

  @Post('especialidades')
  @Roles('ADMIN', 'COORDINADOR', 'SUPERVISOR')
  createEspecialidad(@Body() dto: CreateEspecialidadDto) { return this.service.createEspecialidad(dto); }

  @Patch('especialidades/:id')
  @Roles('ADMIN', 'COORDINADOR', 'SUPERVISOR')
  updateEspecialidad(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEspecialidadDto) { return this.service.updateEspecialidad(id, dto); }

  @Delete('especialidades/:id')
  @Roles('ADMIN', 'SUPERVISOR')
  removeEspecialidad(@Param('id', ParseUUIDPipe) id: string) { return this.service.removeEspecialidad(id); }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }

  @Post()
  @Roles('ADMIN', 'COORDINADOR', 'SUPERVISOR')
  create(@Body() dto: CreateProfesionalDto) { return this.service.create(dto); }

  @Patch(':id')
  @Roles('ADMIN', 'COORDINADOR', 'SUPERVISOR')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProfesionalDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @Roles('ADMIN', 'SUPERVISOR')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }

  @Post(':id/asignaciones')
  @Roles('ADMIN', 'COORDINADOR', 'SUPERVISOR')
  asignar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AsignarProfesionalDto) {
    return this.service.asignar(id, dto.zonaId, dto.especialidadId);
  }
}
