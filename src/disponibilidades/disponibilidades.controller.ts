import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DisponibilidadesService } from './disponibilidades.service';
import { CreateDisponibilidadDto } from './dto/create-disponibilidad.dto';
import { UpdateDisponibilidadDto } from './dto/update-disponibilidad.dto';

@Controller('disponibilidades')
@UseGuards(DevAuthGuard, RolesGuard)
export class DisponibilidadesController {
  constructor(private readonly service: DisponibilidadesService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(@Query('profesionalSaludId') profesionalSaludId?: string) {
    return this.service.findAll(profesionalSaludId);
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR')
  create(@Body() dto: CreateDisponibilidadDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'COORDINADOR')
  update(@Param('id') id: string, @Body() dto: UpdateDisponibilidadDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
