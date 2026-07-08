import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DiagnosticosService } from './diagnosticos.service';
import { CreateDiagnosticoDto } from './dto/create-diagnostico.dto';

@Controller('diagnosticos')
@UseGuards(DevAuthGuard, RolesGuard)
export class DiagnosticosController {
  constructor(private readonly diagnosticosService: DiagnosticosService) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(@Query('visitaId') visitaId?: string) {
    return this.diagnosticosService.findAll({ visitaId });
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.diagnosticosService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  create(@Body() dto: CreateDiagnosticoDto, @Request() req: any) {
    return this.diagnosticosService.create(dto, req.user?.id);
  }
}
