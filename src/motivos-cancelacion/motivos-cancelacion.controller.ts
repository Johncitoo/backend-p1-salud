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
import { MotivosCancelacionService } from './motivos-cancelacion.service';
import { CreateMotivoCancelacionDto } from './dto/create-motivo-cancelacion.dto';
import { UpdateMotivoCancelacionDto } from './dto/update-motivo-cancelacion.dto';

@Controller('motivos-cancelacion')
@UseGuards(DevAuthGuard, RolesGuard)
export class MotivosCancelacionController {
  constructor(private readonly service: MotivosCancelacionService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(@Query('aplicaA') aplicaA?: string) {
    return this.service.findAll(aplicaA);
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR')
  create(@Body() dto: CreateMotivoCancelacionDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'COORDINADOR')
  update(@Param('id') id: string, @Body() dto: UpdateMotivoCancelacionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
