import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { AnalyticsModule } from '../integrations/analytics/analytics.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { Alerta } from './entities/alerta.entity';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    AnalyticsModule,
    TypeOrmModule.forFeature([Alerta]),
  ],
  controllers: [AlertasController],
  providers: [AlertasService],
  exports: [AlertasService],
})
export class AlertasModule {}
