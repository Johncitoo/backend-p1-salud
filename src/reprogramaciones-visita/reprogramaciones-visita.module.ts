import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { ReprogramacionVisita } from './entities/reprogramacion-visita.entity';
import { ReprogramacionesVisitaController } from './reprogramaciones-visita.controller';
import { ReprogramacionesVisitaService } from './reprogramaciones-visita.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    TypeOrmModule.forFeature([ReprogramacionVisita]),
  ],
  controllers: [ReprogramacionesVisitaController],
  providers: [ReprogramacionesVisitaService],
  exports: [ReprogramacionesVisitaService],
})
export class ReprogramacionesVisitaModule {}
