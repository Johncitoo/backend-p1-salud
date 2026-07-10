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
import { VisitaCheckpointsService } from './visita-checkpoints.service';
import { CreateVisitaCheckpointDto } from './dto/create-visita-checkpoint.dto';

@Controller('visita-checkpoints')
@UseGuards(DevAuthGuard, RolesGuard)
export class VisitaCheckpointsController {
  constructor(
    private readonly visitaCheckpointsService: VisitaCheckpointsService,
  ) {}

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(@Query('visitaId') visitaId?: string) {
    return this.visitaCheckpointsService.findAll({ visitaId });
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findOne(@Param('id') id: string) {
    return this.visitaCheckpointsService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  create(@Body() dto: CreateVisitaCheckpointDto, @Request() req: any) {
    return this.visitaCheckpointsService.create(dto, req.user?.id);
  }
}
