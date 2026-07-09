import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateInspeccionMantenimientoDto } from './dto/create-inspeccion-mantenimiento.dto';
import { MantenimientoService } from './mantenimiento.service';

@Controller('mantenimiento')
@UseGuards(DevAuthGuard, RolesGuard)
export class MantenimientoController {
  constructor(private readonly mantenimientoService: MantenimientoService) {}

  // Catálogo de repuestos que el técnico puede elegir en la web.
  @Get('repuestos')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  getCatalogoRepuestos() {
    return this.mantenimientoService.getCatalogoRepuestos();
  }

  // Paso 9 + 10: el técnico registra la inspección y se genera el pedido a P3.
  @Post('inspecciones')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  create(@Body() dto: CreateInspeccionMantenimientoDto, @Request() req: any) {
    return this.mantenimientoService.create(dto, req.user?.id);
  }

  @Get('inspecciones')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(
    @Query('pacienteId') pacienteId?: string,
    @Query('estado') estado?: string,
  ) {
    return this.mantenimientoService.findAll({ pacienteId, estado });
  }

  @Get('inspecciones/:id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.mantenimientoService.findOne(id);
  }

  // Reintenta el pedido a Proyecto 3 si el primer intento falló.
  @Post('inspecciones/:id/reintentar-pedido')
  @Roles('ADMIN', 'COORDINADOR')
  reintentarPedido(@Param('id') id: string) {
    return this.mantenimientoService.reintentarPedido(id);
  }
}
