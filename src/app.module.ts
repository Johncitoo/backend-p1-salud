import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsuariosModule } from './usuarios/usuarios.module';
import { PacientesModule } from './pacientes/pacientes.module';
import { ZonasModule } from './zonas/zonas.module';
import { ProfesionalesModule } from './profesionales/profesionales.module';
import { AuditoriasModule } from './auditorias/auditorias.module';
import { FichasClinicasModule } from './fichas-clinicas/fichas-clinicas.module';
import { MedicionesClinicasModule } from './mediciones-clinicas/mediciones-clinicas.module';
import { PlantillasFichaModule } from './plantillas-ficha/plantillas-ficha.module';
import { VariablesClinicasModule } from './variables-clinicas/variables-clinicas.module';
import { getDatabaseConfig } from './config/database.config';
import { authConfig } from './config/auth.config';
import { AuthModule } from './auth/auth.module';
import { VisitasModule } from './visitas/visitas.module';
import { PrestacionesModule } from './prestaciones/prestaciones.module';
import { DocumentosAdjuntosModule } from './documentos-adjuntos/documentos-adjuntos.module';
import { GoogleCalendarModule } from './google-calendar/google-calendar.module';
import { AlertasModule } from './alertas/alertas.module';
import { MotivosCancelacionModule } from './motivos-cancelacion/motivos-cancelacion.module';
import { MotivosReprogramacionModule } from './motivos-reprogramacion/motivos-reprogramacion.module';
import { IoTModule } from './integrations/iot/iot.module';
import { BloqueosAgendaModule } from './bloqueos-agenda/bloqueos-agenda.module';
import { ReglasAsignacionModule } from './reglas-asignacion/reglas-asignacion.module';
import { ReprogramacionesVisitaModule } from './reprogramaciones-visita/reprogramaciones-visita.module';
import { VisitaEstadoHistorialModule } from './visita-estado-historial/visita-estado-historial.module';
import { VisitaCheckpointsModule } from './visita-checkpoints/visita-checkpoints.module';
import { IncidentesSaludModule } from './incidentes-salud/incidentes-salud.module';
import { IncidenteEstadoHistorialModule } from './incidente-estado-historial/incidente-estado-historial.module';

const isTest = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [authConfig],
    }),
    TypeOrmModule.forRootAsync(
      isTest
        ? {
            useFactory: () => ({
              type: 'sqlite',
              database: ':memory:',
              autoLoadEntities: true,
              synchronize: true,
            }),
          }
        : {
            inject: [ConfigService],
            useFactory: getDatabaseConfig,
          },
    ),
    AuthModule,
    UsuariosModule,
    PacientesModule,
    ZonasModule,
    ProfesionalesModule,
    AuditoriasModule,
    VariablesClinicasModule,
    PlantillasFichaModule,
    FichasClinicasModule,
    MedicionesClinicasModule,
    VisitasModule,
    PrestacionesModule,
    DocumentosAdjuntosModule,
    GoogleCalendarModule,
    AlertasModule,
    MotivosCancelacionModule,
    MotivosReprogramacionModule,
    IoTModule,
    BloqueosAgendaModule,
    ReglasAsignacionModule,
    ReprogramacionesVisitaModule,
    VisitaEstadoHistorialModule,
    VisitaCheckpointsModule,
    IncidentesSaludModule,
    IncidenteEstadoHistorialModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
