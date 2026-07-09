import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { PedidosService } from './pedidos.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [PedidosService],
  exports: [PedidosService],
})
export class PedidosModule {}
