import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateZonaDto } from './dto/create-zona.dto';
import { UpdateZonaDto } from './dto/update-zona.dto';
import { ZonasService } from './zonas.service';

@Controller('zonas')
@UseGuards(DevAuthGuard, RolesGuard)
export class ZonasController {
  constructor(private readonly zonasService: ZonasService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll() {
    return this.zonasService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.zonasService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR')
  create(@Body() dto: CreateZonaDto) {
    return this.zonasService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'COORDINADOR')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateZonaDto) {
    return this.zonasService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.zonasService.remove(id);
  }
}
