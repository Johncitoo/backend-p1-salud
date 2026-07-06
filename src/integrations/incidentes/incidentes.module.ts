import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IncidentesService } from './incidentes.service';

@Module({
  imports: [HttpModule],
  providers: [IncidentesService],
  exports: [IncidentesService],
})
export class IncidentesModule {}
