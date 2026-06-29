import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { ReglaAsignacion } from './entities/regla-asignacion.entity';
import { ReglasAsignacionController } from './reglas-asignacion.controller';
import { ReglasAsignacionService } from './reglas-asignacion.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    TypeOrmModule.forFeature([ReglaAsignacion]),
  ],
  controllers: [ReglasAsignacionController],
  providers: [ReglasAsignacionService],
  exports: [ReglasAsignacionService],
})
export class ReglasAsignacionModule {}
