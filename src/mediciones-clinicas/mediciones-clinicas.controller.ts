import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UsuarioPerfil } from '../usuarios/usuarios.service';
import { CreateMedicionClinicaDto, UpdateMedicionClinicaDto } from './dto/create-medicion-clinica.dto';
import { MedicionesClinicasService } from './mediciones-clinicas.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const toUuidOrUndefined = (id?: string): string | undefined => (id && UUID_RE.test(id) ? id : undefined);

@Controller('mediciones-clinicas')
@UseGuards(DevAuthGuard, RolesGuard)
export class MedicionesClinicasController {
  constructor(private readonly service: MedicionesClinicasService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(
    @Query('pacienteId') pacienteId?: string,
    @Query('visitaId') visitaId?: string,
    @Query('fichaClinicaId') fichaClinicaId?: string,
    @Query('variableClinicaId') variableClinicaId?: string,
    @Query('codigoVariable') codigoVariable?: string,
    @Query('origen') origen?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ) {
    return this.service.findAll({
      pacienteId, visitaId, fichaClinicaId, variableClinicaId,
      codigoVariable, origen, fechaDesde, fechaHasta,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  create(@Body() dto: CreateMedicionClinicaDto, @CurrentUser() user?: UsuarioPerfil) {
    return this.service.create(dto, toUuidOrUndefined(user?.id));
  }

  @Patch(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  update(@Param('id') id: string, @Body() dto: UpdateMedicionClinicaDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPERVISOR')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
