import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuditoriasController } from './auditorias.controller';
import { AuditoriasService } from './auditorias.service';
import { Auditoria } from './entities/auditoria.entity';

@Module({
  imports: [forwardRef(() => UsuariosModule), TypeOrmModule.forFeature([Auditoria])],
  controllers: [AuditoriasController],
  providers: [AuditoriasService, DevAuthGuard, RolesGuard],
  exports: [AuditoriasService],
})
export class AuditoriasModule {}
