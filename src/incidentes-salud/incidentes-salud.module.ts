import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { CrmModule } from '../integrations/crm/crm.module';
import { IncidentesModule } from '../integrations/incidentes/incidentes.module';
import { PacientesModule } from '../pacientes/pacientes.module';
import { Visita } from '../pacientes/entities/visita.entity';
import { ProfesionalSalud } from '../profesionales/entities/profesional-salud.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { IncidenteSalud } from './entities/incidente-salud.entity';
import { IncidentesSaludController } from './incidentes-salud.controller';
import { IncidentesSaludService } from './incidentes-salud.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    CrmModule,
    IncidentesModule,
    forwardRef(() => PacientesModule),
    TypeOrmModule.forFeature([IncidenteSalud, Visita, ProfesionalSalud, Usuario]),
  ],
  controllers: [IncidentesSaludController],
  providers: [IncidentesSaludService],
  exports: [IncidentesSaludService],
})
export class IncidentesSaludModule {}
