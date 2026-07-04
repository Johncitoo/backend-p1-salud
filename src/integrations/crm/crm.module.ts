import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CrmService } from './crm.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
