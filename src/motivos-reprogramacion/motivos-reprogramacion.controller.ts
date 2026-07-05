import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MotivosReprogramacionService } from './motivos-reprogramacion.service';
import { CreateMotivoReprogramacionDto } from './dto/create-motivo-reprogramacion.dto';
import { UpdateMotivoReprogramacionDto } from './dto/update-motivo-reprogramacion.dto';

@Controller('motivos-reprogramacion')
@UseGuards(DevAuthGuard, RolesGuard)
export class MotivosReprogramacionController {
  constructor(private readonly service: MotivosReprogramacionService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR')
  create(@Body() dto: CreateMotivoReprogramacionDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'COORDINADOR')
  update(@Param('id') id: string, @Body() dto: UpdateMotivoReprogramacionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
