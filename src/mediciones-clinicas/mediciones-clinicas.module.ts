import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { MedicionClinica } from './entities/medicion-clinica.entity';
import { MedicionesClinicasController } from './mediciones-clinicas.controller';
import { MedicionesClinicasService } from './mediciones-clinicas.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    TypeOrmModule.forFeature([MedicionClinica]),
  ],
  controllers: [MedicionesClinicasController],
  providers: [MedicionesClinicasService, DevAuthGuard, RolesGuard],
  exports: [MedicionesClinicasService],
})
export class MedicionesClinicasModule {}
