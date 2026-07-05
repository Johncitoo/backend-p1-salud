import { Module } from '@nestjs/common';
import { UsuariosModule } from '../../usuarios/usuarios.module';
import { IoTController } from './iot.controller';
import { IoTService } from './iot.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PacienteSensor } from './entities/paciente-sensor.entity';
import { MedicionesClinicasModule } from '../../mediciones-clinicas/mediciones-clinicas.module';
import { AlertasModule } from '../../alertas/alertas.module';
import { VariablesClinicasModule } from '../../variables-clinicas/variables-clinicas.module';
import { IoTWebhookController } from './iot-webhook.controller';
@Module({
  imports: [
    UsuariosModule,
    TypeOrmModule.forFeature([PacienteSensor]),
    MedicionesClinicasModule,
    AlertasModule,
    VariablesClinicasModule,
  ],
  controllers: [IoTController, IoTWebhookController],
  providers: [IoTService],
  exports: [IoTService],
})
export class IoTModule {}
