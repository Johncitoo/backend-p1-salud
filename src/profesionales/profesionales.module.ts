import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnalyticsModule } from '../integrations/analytics/analytics.module';
import { NotificacionesModule } from '../integrations/notificaciones/notificaciones.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Especialidad } from './entities/especialidad.entity';
import { ProfesionalEspecialidad } from './entities/profesional-especialidad.entity';
import { ProfesionalSalud } from './entities/profesional-salud.entity';
import { ProfesionalZona } from './entities/profesional-zona.entity';
import { ProfesionalesController } from './profesionales.controller';
import { ProfesionalesService } from './profesionales.service';

@Module({
  imports: [UsuariosModule, AuditoriasModule, AnalyticsModule, NotificacionesModule, TypeOrmModule.forFeature([ProfesionalSalud, Especialidad, ProfesionalZona, ProfesionalEspecialidad, Usuario, Rol])],
  controllers: [ProfesionalesController],
  providers: [ProfesionalesService, DevAuthGuard, RolesGuard],
})
export class ProfesionalesModule {}
