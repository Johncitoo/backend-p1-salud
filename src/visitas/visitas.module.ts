import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnalyticsModule } from '../integrations/analytics/analytics.module';
import { NotificacionesModule } from '../integrations/notificaciones/notificaciones.module';
import { PedidosModule } from '../integrations/pedidos/pedidos.module';
import { BloqueoAgenda } from '../bloqueos-agenda/entities/bloqueo-agenda.entity';
import { MotivoCancelacion } from '../motivos-cancelacion/entities/motivo-cancelacion.entity';
import { MotivoReprogramacion } from '../motivos-reprogramacion/entities/motivo-reprogramacion.entity';
import { Medicamento } from '../medicamentos/entities/medicamento.entity';
import { MedicamentoCatalogo } from '../medicamentos/entities/medicamento-catalogo.entity';
import { DireccionPaciente } from '../pacientes/entities/direccion-paciente.entity';
import { Paciente } from '../pacientes/entities/paciente.entity';
import { PlanCuidado } from '../pacientes/entities/plan-cuidado.entity';
import { Visita } from '../pacientes/entities/visita.entity';
import { Prestacion } from '../prestaciones/entities/prestacion.entity';
import { VisitaPrestacion } from '../prestaciones/entities/visita-prestacion.entity';
import { ProfesionalSalud } from '../profesionales/entities/profesional-salud.entity';
import { ReprogramacionVisita } from '../reprogramaciones-visita/entities/reprogramacion-visita.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { VisitaEstadoHistorial } from '../visita-estado-historial/entities/visita-estado-historial.entity';
import { Zona } from '../zonas/entities/zona.entity';
import { VisitasController } from './visitas.controller';
import { VisitasService } from './visitas.service';
import { GoogleCalendarModule } from '../google-calendar/google-calendar.module';
import { VisitasCronService } from './visitas-cron.service';
import { IncidentesSaludModule } from '../incidentes-salud/incidentes-salud.module';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    GoogleCalendarModule,
    AnalyticsModule,
    NotificacionesModule,
    PedidosModule,
    forwardRef(() => IncidentesSaludModule),
    TypeOrmModule.forFeature([
      Visita,
      Paciente,
      ProfesionalSalud,
      Zona,
      PlanCuidado,
      DireccionPaciente,
      Usuario,
      ReprogramacionVisita,
      BloqueoAgenda,
      VisitaEstadoHistorial,
      Prestacion,
      VisitaPrestacion,
      MotivoCancelacion,
      MotivoReprogramacion,
      Medicamento,
      MedicamentoCatalogo,
    ]),
  ],
  controllers: [VisitasController],
  providers: [VisitasService, DevAuthGuard, RolesGuard, VisitasCronService],
  exports: [VisitasService],
})
export class VisitasModule {}
