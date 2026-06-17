import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UsuarioPerfil } from '../usuarios/usuarios.service';
import { CreateVisitaDto } from '../pacientes/dto/create-visita.dto';
import { UpdateVisitaDto } from '../pacientes/dto/update-visita.dto';
import { CancelarVisitaDto } from './dto/cancelar-visita.dto';
import { CambiarEstadoVisitaDto } from './dto/cambiar-estado-visita.dto';
import { CompletarVisitaDto } from './dto/completar-visita.dto';
import { FindVisitasQueryDto } from './dto/find-visitas-query.dto';
import { VisitasService } from './visitas.service';

const uuidOrUndefined = (value?: string) =>
  value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;

@Controller('visitas')
@UseGuards(DevAuthGuard, RolesGuard)
export class VisitasController {
  constructor(private readonly visitasService: VisitasService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(@Query() query: FindVisitasQueryDto, @CurrentUser() user?: UsuarioPerfil) {
    return this.visitasService.findAllForUser(query, user);
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.visitasService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR')
  create(@Body() dto: CreateVisitaDto, @CurrentUser() user?: UsuarioPerfil) {
    return this.visitasService.create(dto, uuidOrUndefined(user?.id));
  }

  @Patch(':id')
  @Roles('ADMIN', 'COORDINADOR')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVisitaDto,
    @CurrentUser() user?: UsuarioPerfil,
  ) {
    return this.visitasService.update(id, dto, uuidOrUndefined(user?.id));
  }

  @Patch(':id/estado')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoVisitaDto,
    @CurrentUser() user?: UsuarioPerfil,
  ) {
    return this.visitasService.cambiarEstado(id, dto, uuidOrUndefined(user?.id));
  }

  @Patch(':id/completar')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  completar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompletarVisitaDto,
    @CurrentUser() user?: UsuarioPerfil,
  ) {
    return this.visitasService.completar(id, dto, uuidOrUndefined(user?.id));
  }

  @Patch(':id/cancelar')
  @Roles('ADMIN', 'COORDINADOR')
  cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelarVisitaDto,
    @CurrentUser() user?: UsuarioPerfil,
  ) {
    return this.visitasService.cancelar(id, dto, uuidOrUndefined(user?.id));
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: UsuarioPerfil) {
    return this.visitasService.remove(id, uuidOrUndefined(user?.id));
  }
}
