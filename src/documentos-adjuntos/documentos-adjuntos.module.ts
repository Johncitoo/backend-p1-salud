import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriasModule } from '../auditorias/auditorias.module';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PacienteAccessModule } from '../auth/services/paciente-access.module';
import { FichaClinica } from '../fichas-clinicas/entities/ficha-clinica.entity';
import { Visita } from '../pacientes/entities/visita.entity';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { DocumentosAdjuntosController } from './documentos-adjuntos.controller';
import { DocumentosAdjuntosService } from './documentos-adjuntos.service';
import { DocumentoAdjunto } from './entities/documento-adjunto.entity';
import { FileEncryptionService } from './services/file-encryption.service';
import { FileValidationService } from './services/file-validation.service';
import { ImageOptimizerService } from './services/image-optimizer.service';
import { LocalStorageService } from './services/local-storage.service';
import { R2StorageService } from './services/r2-storage.service';
import { STORAGE_SERVICE } from './services/storage.interface';

@Module({
  imports: [
    UsuariosModule,
    AuditoriasModule,
    PacienteAccessModule,
    TypeOrmModule.forFeature([DocumentoAdjunto, FichaClinica, Visita]),
  ],
  controllers: [DocumentosAdjuntosController],
  providers: [
    DocumentosAdjuntosService,
    FileValidationService,
    ImageOptimizerService,
    FileEncryptionService,
    R2StorageService,
    LocalStorageService,
    {
      provide: STORAGE_SERVICE,
      // STORAGE_PROVIDER=R2 para produccion (requiere credenciales reales de
      // Cloudflare R2 en .env); por defecto usa disco local, util para
      // desarrollo/pruebas sin depender de un bucket externo.
      useFactory: (config: ConfigService, r2: R2StorageService, local: LocalStorageService) =>
        (config.get<string>('STORAGE_PROVIDER') ?? 'LOCAL').toUpperCase() === 'R2' ? r2 : local,
      inject: [ConfigService, R2StorageService, LocalStorageService],
    },
    DevAuthGuard,
    RolesGuard,
  ],
  exports: [DocumentosAdjuntosService],
})
export class DocumentosAdjuntosModule {}
