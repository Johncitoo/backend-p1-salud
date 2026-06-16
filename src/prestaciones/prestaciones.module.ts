import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Visita } from '../pacientes/entities/visita.entity';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { Prestacion } from './entities/prestacion.entity';
import { VisitaPrestacion } from './entities/visita-prestacion.entity';
import { PrestacionesController } from './prestaciones.controller';
import { PrestacionesService } from './prestaciones.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    TypeOrmModule.forFeature([Prestacion, VisitaPrestacion, Visita]),
  ],
  controllers: [PrestacionesController],
  providers: [PrestacionesService, DevAuthGuard, RolesGuard],
  exports: [PrestacionesService],
})
export class PrestacionesModule {}
