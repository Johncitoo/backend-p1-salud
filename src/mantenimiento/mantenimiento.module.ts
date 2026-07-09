import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { PedidosModule } from '../integrations/pedidos/pedidos.module';
import { IncidentesSaludModule } from '../incidentes-salud/incidentes-salud.module';
import { DireccionPaciente } from '../pacientes/entities/direccion-paciente.entity';
import { Paciente } from '../pacientes/entities/paciente.entity';
import { Visita } from '../pacientes/entities/visita.entity';
import { InspeccionMantenimiento } from './entities/inspeccion-mantenimiento.entity';
import { MantenimientoController } from './mantenimiento.controller';
import { MantenimientoService } from './mantenimiento.service';

@Module({
  imports: [
    HttpModule,
    UsuariosModule, // DevAuthGuard depende de UsuariosService
    AuditoriasModule,
    PedidosModule,
    IncidentesSaludModule, // para generar el ticket en CRM (Grupo 7) + Grupo 11
    TypeOrmModule.forFeature([InspeccionMantenimiento, Paciente, DireccionPaciente, Visita]),
  ],
  controllers: [MantenimientoController],
  providers: [MantenimientoService],
  exports: [MantenimientoService],
})
export class MantenimientoModule {}
