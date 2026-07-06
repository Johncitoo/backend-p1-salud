import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { IncidenteEstadoHistorial } from './entities/incidente-estado-historial.entity';
import { IncidenteEstadoHistorialController } from './incidente-estado-historial.controller';
import { IncidenteEstadoHistorialService } from './incidente-estado-historial.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    TypeOrmModule.forFeature([IncidenteEstadoHistorial]),
  ],
  controllers: [IncidenteEstadoHistorialController],
  providers: [IncidenteEstadoHistorialService],
  exports: [IncidenteEstadoHistorialService],
})
export class IncidenteEstadoHistorialModule {}
