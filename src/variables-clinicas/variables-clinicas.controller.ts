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
import { Roles } from '../auth/decorators/roles.decorator';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateVariableClinicaDto,
  UpdateVariableClinicaDto,
} from './dto/create-variable-clinica.dto';
import { VariablesClinicasService } from './variables-clinicas.service';

@Controller('variables-clinicas')
@UseGuards(DevAuthGuard, RolesGuard)
export class VariablesClinicasController {
  constructor(private readonly service: VariablesClinicasService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(
    @Query('codigo') codigo?: string,
    @Query('nombre') nombre?: string,
    @Query('categoria') categoria?: string,
    @Query('activa') activa?: string,
  ) {
    return this.service.findAll({
      codigo,
      nombre,
      categoria,
      activa: activa !== undefined ? activa === 'true' : undefined,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR')
  create(@Body() dto: CreateVariableClinicaDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'COORDINADOR')
  update(@Param('id') id: string, @Body() dto: UpdateVariableClinicaDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
