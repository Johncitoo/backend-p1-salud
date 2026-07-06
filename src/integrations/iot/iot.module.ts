import { Module } from '@nestjs/common';
import { UsuariosModule } from '../../usuarios/usuarios.module';
import { IoTController } from './iot.controller';
import { IoTService } from './iot.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PacienteSensor } from './entities/paciente-sensor.entity';
import { MedicionesClinicasModule } from '../../mediciones-clinicas/mediciones-clinicas.module';
import { AlertasModule } from '../../alertas/alertas.module';
import { VariablesClinicasModule } from '../../variables-clinicas/variables-clinicas.module';
import { IoTSyncService } from './iot-sync.service';
import { IncidentesSaludModule } from '../../incidentes-salud/incidentes-salud.module';

@Module({
  imports: [
    UsuariosModule,
    TypeOrmModule.forFeature([PacienteSensor]),
    MedicionesClinicasModule,
    AlertasModule,
    VariablesClinicasModule,
    IncidentesSaludModule,
  ],
  controllers: [IoTController],
  providers: [IoTService, IoTSyncService],
  exports: [IoTService],
})
export class IoTModule {}
