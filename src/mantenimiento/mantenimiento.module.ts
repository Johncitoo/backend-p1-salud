import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { PedidosModule } from '../integrations/pedidos/pedidos.module';
import { DireccionPaciente } from '../pacientes/entities/direccion-paciente.entity';
import { Paciente } from '../pacientes/entities/paciente.entity';
import { InspeccionMantenimiento } from './entities/inspeccion-mantenimiento.entity';
import { MantenimientoController } from './mantenimiento.controller';
import { MantenimientoService } from './mantenimiento.service';

@Module({
  imports: [
    UsuariosModule, // DevAuthGuard depende de UsuariosService
    AuditoriasModule,
    PedidosModule,
    TypeOrmModule.forFeature([InspeccionMantenimiento, Paciente, DireccionPaciente]),
  ],
  controllers: [MantenimientoController],
  providers: [MantenimientoService],
  exports: [MantenimientoService],
})
export class MantenimientoModule {}
