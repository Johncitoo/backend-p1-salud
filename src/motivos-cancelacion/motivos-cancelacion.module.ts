import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { MotivoCancelacion } from './entities/motivo-cancelacion.entity';
import { MotivosCancelacionController } from './motivos-cancelacion.controller';
import { MotivosCancelacionService } from './motivos-cancelacion.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    TypeOrmModule.forFeature([MotivoCancelacion]),
  ],
  controllers: [MotivosCancelacionController],
  providers: [MotivosCancelacionService],
  exports: [MotivosCancelacionService],
})
export class MotivosCancelacionModule {}
