import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreatePlantillaFichaCampoDto {
  @IsUUID()
  @IsOptional()
  variableClinicaId?: string | null;

  @IsString()
  @Length(1, 100)
  codigoCampo: string;

  @IsString()
  @Length(1, 150)
  etiqueta: string;

  @IsString()
  tipoCampo: string;

  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsString()
  ayudaTexto?: string;

  @IsOptional()
  @IsObject()
  opciones?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdatePlantillaFichaCampoDto {
  @IsOptional()
  @IsUUID()
  variableClinicaId?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  codigoCampo?: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  etiqueta?: string;

  @IsOptional()
  @IsString()
  tipoCampo?: string;

  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsString()
  ayudaTexto?: string;

  @IsOptional()
  @IsObject()
  opciones?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
