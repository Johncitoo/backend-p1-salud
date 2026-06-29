import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnalyticsModule } from '../integrations/analytics/analytics.module';
import { NotificacionesModule } from '../integrations/notificaciones/notificaciones.module';
import { DireccionPaciente } from '../pacientes/entities/direccion-paciente.entity';
import { Paciente } from '../pacientes/entities/paciente.entity';
import { PlanCuidado } from '../pacientes/entities/plan-cuidado.entity';
import { Visita } from '../pacientes/entities/visita.entity';
import { ProfesionalSalud } from '../profesionales/entities/profesional-salud.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { Zona } from '../zonas/entities/zona.entity';
import { VisitasController } from './visitas.controller';
import { VisitasService } from './visitas.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    AnalyticsModule,
    NotificacionesModule,
    TypeOrmModule.forFeature([Visita, Paciente, ProfesionalSalud, Zona, PlanCuidado, DireccionPaciente, Usuario]),
  ],
  controllers: [VisitasController],
  providers: [VisitasService, DevAuthGuard, RolesGuard],
  exports: [VisitasService],
})
export class VisitasModule {}
