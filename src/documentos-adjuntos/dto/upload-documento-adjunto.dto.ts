import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const DOCUMENTO_CATEGORIAS = [
  'GENERAL',
  'FOTO_CLINICA',
  'CONSENTIMIENTO',
  'INDICACION',
  'EXAMEN',
  'OTRO',
] as const;

export type DocumentoCategoria = (typeof DOCUMENTO_CATEGORIAS)[number];

export class UploadDocumentoAdjuntoDto {
  @IsUUID()
  fichaClinicaId: string;

  @IsOptional()
  @IsIn(DOCUMENTO_CATEGORIAS)
  categoria?: DocumentoCategoria;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}

