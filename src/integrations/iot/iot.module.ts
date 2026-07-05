import { Module } from '@nestjs/common';
import { UsuariosModule } from '../../usuarios/usuarios.module';
import { IoTController } from './iot.controller';
import { IoTService } from './iot.service';

@Module({
  imports: [UsuariosModule],
  controllers: [IoTController],
  providers: [IoTService],
  exports: [IoTService],
})
export class IoTModule {}
