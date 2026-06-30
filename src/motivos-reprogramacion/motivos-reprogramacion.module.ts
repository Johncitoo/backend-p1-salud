import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { MotivoReprogramacion } from './entities/motivo-reprogramacion.entity';
import { MotivosReprogramacionController } from './motivos-reprogramacion.controller';
import { MotivosReprogramacionService } from './motivos-reprogramacion.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    TypeOrmModule.forFeature([MotivoReprogramacion]),
  ],
  controllers: [MotivosReprogramacionController],
  providers: [MotivosReprogramacionService],
  exports: [MotivosReprogramacionService],
})
export class MotivosReprogramacionModule {}
