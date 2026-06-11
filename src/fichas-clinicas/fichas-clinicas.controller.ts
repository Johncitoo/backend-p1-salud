import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UsuarioPerfil } from '../usuarios/usuarios.service';
import { CreateFichaClinicaDto, UpdateFichaClinicaDto } from './dto/create-ficha-clinica.dto';
import { FichasClinicasService } from './fichas-clinicas.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toUuidOrUndefined = (id?: string): string | undefined =>
  id && UUID_RE.test(id) ? id : undefined;

@Controller('fichas-clinicas')
@UseGuards(DevAuthGuard, RolesGuard)
export class FichasClinicasController {
  constructor(private readonly service: FichasClinicasService) {};

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(
    @Query('visitaId') visitaId?: string,
    @Query('pacienteId') pacienteId?: string,
    @Query('estado') estado?: string,
  ) {
    return this.service.findAll({ visitaId, pacienteId, estado });
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  create(@Body() dto: CreateFichaClinicaDto, @CurrentUser() user?: UsuarioPerfil) {
    return this.service.create(dto, toUuidOrUndefined(user?.id));
  }

  @Patch(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFichaClinicaDto,
    @CurrentUser() user?: UsuarioPerfil,
    @Query('version') versionStr?: string,
  ) {
    const expectedVersion = versionStr ? parseInt(versionStr, 10) : undefined;
    return this.service.update(id, dto, toUuidOrUndefined(user?.id), expectedVersion);
  }

  @Patch(':id/cerrar')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  cerrar(@Param('id') id: string, @CurrentUser() user?: UsuarioPerfil) {
    return this.service.cerrar(id, toUuidOrUndefined(user?.id));
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
