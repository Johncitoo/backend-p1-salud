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
import { ReglasAsignacionService } from './reglas-asignacion.service';
import { CreateReglaAsignacionDto } from './dto/create-regla-asignacion.dto';
import { UpdateReglaAsignacionDto } from './dto/update-regla-asignacion.dto';

@Controller('reglas-asignacion')
@UseGuards(DevAuthGuard, RolesGuard)
export class ReglasAsignacionController {
  constructor(
    private readonly reglasAsignacionService: ReglasAsignacionService,
  ) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(@Query('activa') activa?: string) {
    const filtros: { activa?: boolean } = {};
    if (activa !== undefined) filtros.activa = activa === 'true';
    return this.reglasAsignacionService.findAll(filtros);
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.reglasAsignacionService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR')
  create(@Body() dto: CreateReglaAsignacionDto, @Request() req: any) {
    return this.reglasAsignacionService.create(dto, req.user?.id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'COORDINADOR')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReglaAsignacionDto,
    @Request() req: any,
  ) {
    return this.reglasAsignacionService.update(id, dto, req.user?.id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.reglasAsignacionService.remove(id, req.user?.id);
  }
}
