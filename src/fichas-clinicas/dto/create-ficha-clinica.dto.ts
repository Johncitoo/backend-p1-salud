import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFichaClinicaDto {
  @IsUUID()
  visitaId: string;

  @IsOptional()
  @IsUUID()
  plantillaFichaId?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsObject()
  contenido: Record<string, unknown>;
}

export class UpdateFichaClinicaDto {
  @IsOptional()
  @IsUUID()
  plantillaFichaId?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsObject()
  contenido?: Record<string, unknown>;
}
