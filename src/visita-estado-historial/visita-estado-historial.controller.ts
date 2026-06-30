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
import { VisitaEstadoHistorialService } from './visita-estado-historial.service';
import { CreateVisitaEstadoHistorialDto } from './dto/create-visita-estado-historial.dto';

@Controller('visita-estado-historial')
@UseGuards(DevAuthGuard, RolesGuard)
export class VisitaEstadoHistorialController {
  constructor(private readonly visitaEstadoHistorialService: VisitaEstadoHistorialService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(@Query('visitaId') visitaId?: string) {
    return this.visitaEstadoHistorialService.findAll({ visitaId });
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.visitaEstadoHistorialService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR')
  create(@Body() dto: CreateVisitaEstadoHistorialDto, @Request() req: any) {
    return this.visitaEstadoHistorialService.create(dto, req.user?.id);
  }
}
