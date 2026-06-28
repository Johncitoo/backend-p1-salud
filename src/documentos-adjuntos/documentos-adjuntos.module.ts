import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FichaClinica } from '../fichas-clinicas/entities/ficha-clinica.entity';
import { Visita } from '../pacientes/entities/visita.entity';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { DocumentosAdjuntosController } from './documentos-adjuntos.controller';
import { DocumentosAdjuntosService } from './documentos-adjuntos.service';
import { DocumentoAdjunto } from './entities/documento-adjunto.entity';
import { FileEncryptionService } from './services/file-encryption.service';
import { FileValidationService } from './services/file-validation.service';
import { ImageOptimizerService } from './services/image-optimizer.service';
import { R2StorageService } from './services/r2-storage.service';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    TypeOrmModule.forFeature([DocumentoAdjunto, FichaClinica, Visita]),
  ],
  controllers: [DocumentosAdjuntosController],
  providers: [
    DocumentosAdjuntosService,
    FileValidationService,
    ImageOptimizerService,
    FileEncryptionService,
    R2StorageService,
    DevAuthGuard,
    RolesGuard,
  ],
  exports: [DocumentosAdjuntosService],
})
export class DocumentosAdjuntosModule {}
