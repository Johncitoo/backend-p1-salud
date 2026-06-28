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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
