import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Visita } from '../pacientes/entities/visita.entity';
import { ProfesionalSalud } from '../profesionales/entities/profesional-salud.entity';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { GoogleCalendarSyncLog } from './entities/google-calendar-sync-log.entity';
import { ProfesionalGoogleCalendarConnection } from './entities/profesional-google-calendar-connection.entity';
import { GoogleCalendarController } from './google-calendar.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleCalendarClientService } from './services/google-calendar-client.service';
import { GoogleCalendarSyncService } from './services/google-calendar-sync.service';
import { GoogleTokenEncryptionService } from './services/google-token-encryption.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    TypeOrmModule.forFeature([
      ProfesionalGoogleCalendarConnection,
      GoogleCalendarSyncLog,
      ProfesionalSalud,
      Visita,
    ]),
  ],
  controllers: [GoogleCalendarController],
  providers: [
    GoogleCalendarService,
    GoogleCalendarClientService,
    GoogleCalendarSyncService,
    GoogleTokenEncryptionService,
    DevAuthGuard,
    RolesGuard,
  ],
  exports: [GoogleCalendarSyncService],
})
export class GoogleCalendarModule {}
