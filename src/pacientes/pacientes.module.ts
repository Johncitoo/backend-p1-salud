import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { VisitasModule } from '../visitas/visitas.module';
import { Paciente } from './entities/paciente.entity';
import { DireccionPaciente } from './entities/direccion-paciente.entity';
import { ContactoPaciente } from './entities/contacto-paciente.entity';
import { PlanCuidado } from './entities/plan-cuidado.entity';
import { Visita } from './entities/visita.entity';
import { PacientesController } from './pacientes.controller';
import { PacientesService } from './pacientes.service';

@Module({
  imports: [UsuariosModule, AuditoriasModule, VisitasModule, TypeOrmModule.forFeature([Paciente, DireccionPaciente, ContactoPaciente, PlanCuidado, Visita])],
  controllers: [PacientesController],
  providers: [PacientesService, DevAuthGuard, RolesGuard],
})
export class PacientesModule {}
