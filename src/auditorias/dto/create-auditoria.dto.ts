import { IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateAuditoriaDto {
  @IsUUID()
  usuarioId: string;

  @IsString()
  @Length(1, 100)
  entidad: string;

  @IsUUID()
  entidadId: string;

  @IsString()
  @Length(1, 100)
  accion: string;

  @IsOptional()
  @IsString()
  detalle?: string | null;

  @IsOptional()
  @IsObject()
  oldValues?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  newValues?: Record<string, unknown> | null;
}
