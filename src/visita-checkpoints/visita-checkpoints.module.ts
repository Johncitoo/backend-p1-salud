import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { VisitaCheckpoint } from './entities/visita-checkpoint.entity';
import { VisitaCheckpointsController } from './visita-checkpoints.controller';
import { VisitaCheckpointsService } from './visita-checkpoints.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    TypeOrmModule.forFeature([VisitaCheckpoint]),
  ],
  controllers: [VisitaCheckpointsController],
  providers: [VisitaCheckpointsService],
  exports: [VisitaCheckpointsService],
})
export class VisitaCheckpointsModule {}
