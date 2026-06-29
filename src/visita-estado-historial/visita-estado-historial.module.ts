import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { VisitaEstadoHistorial } from './entities/visita-estado-historial.entity';
import { VisitaEstadoHistorialController } from './visita-estado-historial.controller';
import { VisitaEstadoHistorialService } from './visita-estado-historial.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    TypeOrmModule.forFeature([VisitaEstadoHistorial]),
  ],
  controllers: [VisitaEstadoHistorialController],
  providers: [VisitaEstadoHistorialService],
  exports: [VisitaEstadoHistorialService],
})
export class VisitaEstadoHistorialModule {}
