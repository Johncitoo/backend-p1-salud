import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { Diagnostico } from './entities/diagnostico.entity';
import { DiagnosticosController } from './diagnosticos.controller';
import { DiagnosticosService } from './diagnosticos.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    TypeOrmModule.forFeature([Diagnostico]),
  ],
  controllers: [DiagnosticosController],
  providers: [DiagnosticosService],
  exports: [DiagnosticosService],
})
export class DiagnosticosModule {}
