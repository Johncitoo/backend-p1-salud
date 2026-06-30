import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnalyticsModule } from '../integrations/analytics/analytics.module';
import { MedicionClinica } from '../mediciones-clinicas/entities/medicion-clinica.entity';
import { PlantillasFichaModule } from '../plantillas-ficha/plantillas-ficha.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { VariablesClinicasModule } from '../variables-clinicas/variables-clinicas.module';
import { FichaClinica } from './entities/ficha-clinica.entity';
import { FichasClinicasController } from './fichas-clinicas.controller';
import { FichasClinicasService } from './fichas-clinicas.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    AnalyticsModule,
    VariablesClinicasModule,
    PlantillasFichaModule,
    TypeOrmModule.forFeature([FichaClinica, MedicionClinica]),
  ],
  controllers: [FichasClinicasController],
  providers: [FichasClinicasService, DevAuthGuard, RolesGuard],
  exports: [FichasClinicasService],
})
export class FichasClinicasModule {}
