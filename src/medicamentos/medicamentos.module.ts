import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { PacienteAccessModule } from '../auth/services/paciente-access.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { Medicamento } from './entities/medicamento.entity';
import { MedicamentoCatalogo } from './entities/medicamento-catalogo.entity';
import { MedicamentosController } from './medicamentos.controller';
import { MedicamentosService } from './medicamentos.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    PacienteAccessModule,
    TypeOrmModule.forFeature([Medicamento, MedicamentoCatalogo]),
  ],
  controllers: [MedicamentosController],
  providers: [MedicamentosService],
  exports: [MedicamentosService],
})
export class MedicamentosModule {}
