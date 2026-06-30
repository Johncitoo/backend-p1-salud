import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AlertasService } from './alertas.service';
import { CreateAlertaDto } from './dto/create-alerta.dto';
import { UpdateAlertaDto } from './dto/update-alerta.dto';

@Controller('alertas')
@UseGuards(DevAuthGuard, RolesGuard)
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(
    @Query('pacienteId') pacienteId?: string,
    @Query('visitaId') visitaId?: string,
    @Query('estado') estado?: string,
    @Query('prioridad') prioridad?: string,
  ) {
    return this.alertasService.findAll({
      pacienteId,
      visitaId,
      estado,
      prioridad,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.alertasService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  create(@Body() dto: CreateAlertaDto, @Request() req: any) {
    return this.alertasService.create(dto, req.user?.id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAlertaDto,
    @Request() req: any,
  ) {
    return this.alertasService.update(id, dto, req.user?.id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.alertasService.remove(id, req.user?.id);
  }
}
