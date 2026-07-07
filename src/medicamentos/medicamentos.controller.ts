import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MedicamentosService } from './medicamentos.service';
import { CreateMedicamentoDto } from './dto/create-medicamento.dto';

@Controller('medicamentos')
@UseGuards(DevAuthGuard, RolesGuard)
export class MedicamentosController {
  constructor(private readonly medicamentosService: MedicamentosService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(@Query('visitaId') visitaId?: string) {
    return this.medicamentosService.findAll({ visitaId });
  }

  // Nota de rutas: este método debe ir antes de "@Get(':id')" para que
  // "/medicamentos/catalogo" no sea interpretado como un :id.
  @Get('catalogo')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findCatalogo() {
    return this.medicamentosService.findCatalogo();
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
