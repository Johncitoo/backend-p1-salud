import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { BloqueoAgenda } from './entities/bloqueo-agenda.entity';
import { BloqueosAgendaController } from './bloqueos-agenda.controller';
import { BloqueosAgendaService } from './bloqueos-agenda.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    TypeOrmModule.forFeature([BloqueoAgenda]),
  ],
  controllers: [BloqueosAgendaController],
  providers: [BloqueosAgendaService],
  exports: [BloqueosAgendaService],
})
export class BloqueosAgendaModule {}
