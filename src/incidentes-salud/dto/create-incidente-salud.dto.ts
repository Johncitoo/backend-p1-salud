import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateIncidenteSaludDto {
  @IsString()
  @MaxLength(80)
  tipo: string;

  @IsOptional()
  @IsIn(['BAJA', 'MEDIA', 'ALTA', 'CRITICA'])
  severidad?: string;

  @IsOptional()
  @IsIn(['ABIERTO', 'EN_REVISION', 'RESUELTO', 'CERRADO', 'CANCELADO'])
  estado?: string;

  @IsString()
  @MaxLength(180)
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsUUID()
  pacienteId?: string;

  @IsOptional()
  @IsUUID()
  visitaId?: string;

  @IsOptional()
  @IsUUID()
  alertaId?: string;

  @IsOptional()
  @IsUUID()
  profesionalSaludId?: string;

  @IsOptional()
  @IsUUID()
  responsableUsuarioId?: string;

  @IsOptional()
  @IsIn(['WEB', 'APP', 'SISTEMA', 'INTEGRACION'])
  origen?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  externalIncidentId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
