import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { VariableClinica } from './entities/variable-clinica.entity';
import { VariablesClinicasController } from './variables-clinicas.controller';
import { VariablesClinicasService } from './variables-clinicas.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    TypeOrmModule.forFeature([VariableClinica]),
  ],
  controllers: [VariablesClinicasController],
  providers: [VariablesClinicasService, DevAuthGuard, RolesGuard],
  exports: [VariablesClinicasService],
})
export class VariablesClinicasModule {}
