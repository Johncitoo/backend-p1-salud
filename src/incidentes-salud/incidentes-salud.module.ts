import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { IncidenteSalud } from './entities/incidente-salud.entity';
import { IncidentesSaludController } from './incidentes-salud.controller';
import { IncidentesSaludService } from './incidentes-salud.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    TypeOrmModule.forFeature([IncidenteSalud]),
  ],
  controllers: [IncidentesSaludController],
  providers: [IncidentesSaludService],
  exports: [IncidentesSaludService],
})
export class IncidentesSaludModule {}
