import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnalyticsModule } from '../integrations/analytics/analytics.module';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [
    forwardRef(() => AuditoriasModule),
    AnalyticsModule,
    TypeOrmModule.forFeature([Usuario, Rol]),
  ],
  controllers: [UsuariosController],
  providers: [UsuariosService, DevAuthGuard, RolesGuard],
  exports: [UsuariosService],
})
export class UsuariosModule {}
