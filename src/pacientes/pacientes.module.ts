import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Paciente } from './entities/paciente.entity';
import { DireccionPaciente } from './entities/direccion-paciente.entity';
import { ContactoPaciente } from './entities/contacto-paciente.entity';
import { PlanCuidado } from './entities/plan-cuidado.entity';
import { Visita } from './entities/visita.entity';
import { PacientesController } from './pacientes.controller';
import { PacientesService } from './pacientes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Paciente, DireccionPaciente, ContactoPaciente, PlanCuidado, Visita])],
  controllers: [PacientesController],
  providers: [PacientesService],
})
export class PacientesModule {}
