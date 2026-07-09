import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MedicamentosService } from './medicamentos.service';
import { CreateMedicamentoDto } from './dto/create-medicamento.dto';
import { CreateMedicamentoCatalogoDto } from './dto/create-medicamento-catalogo.dto';
import { UpdateMedicamentoCatalogoDto } from './dto/update-medicamento-catalogo.dto';

@Controller('medicamentos')
@UseGuards(DevAuthGuard, RolesGuard)
export class MedicamentosController {
  constructor(private readonly medicamentosService: MedicamentosService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(@Query('visitaId') visitaId?: string) {
    return this.medicamentosService.findAll({ visitaId });
  }

  // Nota de rutas: estos métodos deben ir antes de "@Get(':id')" / "@Patch(':id')"
  // para que "/medicamentos/catalogo..." no sea interpretado como un :id.
  @Get('catalogo')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findCatalogo(@Query('incluirInactivos') incluirInactivos?: string) {
    return this.medicamentosService.findCatalogo(incluirInactivos === 'true');
  }

  @Post('catalogo')
  @Roles('ADMIN')
  createCatalogo(@Body() dto: CreateMedicamentoCatalogoDto, @Request() req: any) {
    return this.medicamentosService.createCatalogo(dto, req.user?.id);
  }

  @Patch('catalogo/:id')
  @Roles('ADMIN')
  updateCatalogo(
    @Param('id') id: string,
    @Body() dto: UpdateMedicamentoCatalogoDto,
    @Request() req: any,
  ) {
    return this.medicamentosService.updateCatalogo(id, dto, req.user?.id);
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.medicamentosService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  create(@Body() dto: CreateMedicamentoDto, @Request() req: any) {
    return this.medicamentosService.create(dto, req.user?.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.medicamentosService.remove(id, req.user?.id);
  }
}
