import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditoriasService } from './auditorias.service';
import { CreateAuditoriaDto } from './dto/create-auditoria.dto';

@Controller('auditorias')
@UseGuards(DevAuthGuard, RolesGuard)
export class AuditoriasController {
  constructor(private readonly service: AuditoriasService) {}

  @Get()
  @Roles('ADMIN', 'SUPERVISOR')
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @Roles('ADMIN', 'SUPERVISOR')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }

  @Post()
  @Roles('ADMIN', 'SUPERVISOR')
  create(@Body() dto: CreateAuditoriaDto) { return this.service.create(dto); }
}
