import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { Zona } from './entities/zona.entity';
import { ZonasController } from './zonas.controller';
import { ZonasService } from './zonas.service';

@Module({
  imports: [UsuariosModule, AuditoriasModule, TypeOrmModule.forFeature([Zona])],
  controllers: [ZonasController],
  providers: [ZonasService, DevAuthGuard, RolesGuard],
})
export class ZonasModule {}
