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
import { ReprogramacionesVisitaService } from './reprogramaciones-visita.service';
import { CreateReprogramacionVisitaDto } from './dto/create-reprogramacion-visita.dto';

@Controller('reprogramaciones-visita')
@UseGuards(DevAuthGuard, RolesGuard)
export class ReprogramacionesVisitaController {
  constructor(private readonly reprogramacionesVisitaService: ReprogramacionesVisitaService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(@Query('visitaId') visitaId?: string) {
    return this.reprogramacionesVisitaService.findAll({ visitaId });
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.reprogramacionesVisitaService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR')
  create(@Body() dto: CreateReprogramacionVisitaDto, @Request() req: any) {
    return this.reprogramacionesVisitaService.create(dto, req.user?.id);
  }
}
