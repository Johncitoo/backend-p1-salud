import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreatePlantillaFichaDto, UpdatePlantillaFichaDto } from './dto/create-plantilla-ficha.dto';
import { CreatePlantillaFichaCampoDto, UpdatePlantillaFichaCampoDto } from './dto/create-plantilla-ficha-campo.dto';
import { PlantillasFichaService } from './plantillas-ficha.service';

@Controller('plantillas-ficha')
@UseGuards(DevAuthGuard, RolesGuard)
export class PlantillasFichaController {
  constructor(private readonly service: PlantillasFichaService) {}

  // ---- plantillas ----

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.service.findOneWithCampos(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  create(@Body() dto: CreatePlantillaFichaDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  update(@Param('id') id: string, @Body() dto: UpdatePlantillaFichaDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ---- campos (subrecurso) ----

  @Get(':id/campos')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findCampos(@Param('id') id: string) {
    return this.service.findCamposByPlantilla(id);
  }

  @Post(':id/campos')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  createCampo(@Param('id') id: string, @Body() dto: CreatePlantillaFichaCampoDto) {
    return this.service.createCampo({ ...dto, plantillaFichaId: id });
  }

  @Patch('campos/:id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  updateCampo(@Param('id') id: string, @Body() dto: UpdatePlantillaFichaCampoDto) {
    return this.service.updateCampo(id, dto);
  }

  @Delete('campos/:id')
  @Roles('ADMIN')
  removeCampo(@Param('id') id: string) {
    return this.service.removeCampo(id);
  }
}
