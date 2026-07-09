import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Visita } from '../../pacientes/entities/visita.entity';
import { ProfesionalSalud } from '../../profesionales/entities/profesional-salud.entity';
import { PacienteAccessService } from './paciente-access.service';

@Module({
  imports: [TypeOrmModule.forFeature([Visita, ProfesionalSalud])],
  providers: [PacienteAccessService],
  exports: [PacienteAccessService],
})
export class PacienteAccessModule {}
