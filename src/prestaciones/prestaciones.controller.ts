import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UsuarioPerfil } from '../usuarios/usuarios.service';
import { CreatePrestacionDto, UpdatePrestacionDto } from './dto/create-prestacion.dto';
import { CreateVisitaPrestacionDto, UpdateVisitaPrestacionDto } from './dto/create-visita-prestacion.dto';
import { PrestacionesService } from './prestaciones.service';

@Controller()
@UseGuards(DevAuthGuard, RolesGuard)
export class PrestacionesController {
  constructor(private readonly service: PrestacionesService) {}

  @Get('prestaciones')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(@Query('activa') activa?: string, @Query('q') q?: string) {
    return this.service.findAll({
      activa: activa !== undefined ? activa === 'true' : undefined,
      q,
    });
  }

  @Post('prestaciones')
  @Roles('ADMIN', 'COORDINADOR')
  create(@Body() dto: CreatePrestacionDto) {
    return this.service.create(dto);
  }

  @Patch('prestaciones/:id')
  @Roles('ADMIN', 'COORDINADOR')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePrestacionDto) {
    return this.service.update(id, dto);
  }

  @Delete('prestaciones/:id')
  @Roles('ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  @Get('visitas/:id/prestaciones')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findByVisita(@Param('id', ParseUUIDPipe) visitaId: string) {
    return this.service.findByVisita(visitaId);
  }

  @Post('visitas/:id/prestaciones')
  @Roles('ADMIN', 'COORDINADOR')
  addToVisita(
    @Param('id', ParseUUIDPipe) visitaId: string,
    @Body() dto: CreateVisitaPrestacionDto,
    @CurrentUser() user?: UsuarioPerfil,
  ) {
    return this.service.addToVisita(visitaId, dto, toUuidOrUndefined(user?.id));
  }

  @Patch('visitas/:id/prestaciones/:prestacionId')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  updateVisitaPrestacion(
    @Param('id', ParseUUIDPipe) visitaId: string,
    @Param('prestacionId', ParseUUIDPipe) prestacionId: string,
    @Body() dto: UpdateVisitaPrestacionDto,
    @CurrentUser() user?: UsuarioPerfil,
  ) {
    return this.service.updateVisitaPrestacion(visitaId, prestacionId, dto, toUuidOrUndefined(user?.id));
  }

  @Delete('visitas/:id/prestaciones/:prestacionId')
  @Roles('ADMIN', 'COORDINADOR')
  removeFromVisita(
    @Param('id', ParseUUIDPipe) visitaId: string,
    @Param('prestacionId', ParseUUIDPipe) prestacionId: string,
    @CurrentUser() user?: UsuarioPerfil,
  ) {
    return this.service.removeFromVisita(visitaId, prestacionId, toUuidOrUndefined(user?.id));
  }
}

const toUuidOrUndefined = (value?: string) =>
  value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
