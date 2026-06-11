import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { VariablesClinicasModule } from '../variables-clinicas/variables-clinicas.module';
import { PlantillaFichaCampo } from './entities/plantilla-ficha-campo.entity';
import { PlantillaFicha } from './entities/plantilla-ficha.entity';
import { PlantillasFichaController } from './plantillas-ficha.controller';
import { PlantillasFichaService } from './plantillas-ficha.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    VariablesClinicasModule,
    TypeOrmModule.forFeature([PlantillaFicha, PlantillaFichaCampo]),
  ],
  controllers: [PlantillasFichaController],
  providers: [PlantillasFichaService, DevAuthGuard, RolesGuard],
  exports: [PlantillasFichaService],
})
export class PlantillasFichaModule {}
