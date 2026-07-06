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
import { BloqueosAgendaService } from './bloqueos-agenda.service';
import { CreateBloqueoAgendaDto } from './dto/create-bloqueo-agenda.dto';
import { UpdateBloqueoAgendaDto } from './dto/update-bloqueo-agenda.dto';

@Controller('bloqueos-agenda')
@UseGuards(DevAuthGuard, RolesGuard)
export class BloqueosAgendaController {
  constructor(private readonly bloqueosAgendaService: BloqueosAgendaService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(
    @Query('tipo') tipo?: string,
    @Query('profesionalSaludId') profesionalSaludId?: string,
    @Query('zonaId') zonaId?: string,
    @Query('estado') estado?: string,
  ) {
    return this.bloqueosAgendaService.findAll({
      tipo,
      profesionalSaludId,
      zonaId,
      estado,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.bloqueosAgendaService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR')
  create(@Body() dto: CreateBloqueoAgendaDto, @Request() req: any) {
    return this.bloqueosAgendaService.create(dto, req.user?.id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'COORDINADOR')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBloqueoAgendaDto,
    @Request() req: any,
  ) {
    return this.bloqueosAgendaService.update(id, dto, req.user?.id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.bloqueosAgendaService.remove(id, req.user?.id);
  }
}
