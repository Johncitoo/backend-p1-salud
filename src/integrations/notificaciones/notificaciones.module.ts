import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevAuthGuard } from '../../auth/guards/dev-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UsuariosModule } from '../../usuarios/usuarios.module';
import { NotificacionEnviada } from './entities/notificacion-enviada.entity';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';

@Module({
  imports: [UsuariosModule, TypeOrmModule.forFeature([NotificacionEnviada])],
  controllers: [NotificacionesController],
  providers: [NotificacionesService, DevAuthGuard, RolesGuard],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
