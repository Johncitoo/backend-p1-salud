import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { DisponibilidadProfesional } from './entities/disponibilidad-profesional.entity';
import { DisponibilidadesController } from './disponibilidades.controller';
import { DisponibilidadesService } from './disponibilidades.service';

@Module({
  imports: [UsuariosModule, AuditoriasModule, TypeOrmModule.forFeature([DisponibilidadProfesional])],
  controllers: [DisponibilidadesController],
  providers: [DisponibilidadesService],
  exports: [DisponibilidadesService],
})
export class DisponibilidadesModule {}
