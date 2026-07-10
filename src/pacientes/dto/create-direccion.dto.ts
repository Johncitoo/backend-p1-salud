import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

const DIRECCION_TIPOS = ['DOMICILIO', 'TEMPORAL', 'CUIDADOR', 'OTRO'] as const;

export class CreateDireccionDto {
  @IsUUID()
  pacienteId: string;

  @IsOptional()
  @IsUUID()
  zonaId?: string;

  @IsOptional()
  @IsIn(DIRECCION_TIPOS)
  tipo?: string;

  @IsOptional()
  @IsString()
  calle?: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsString()
  departamento?: string;

  @IsOptional()
  @IsString()
  villaPoblacion?: string;

  @IsNotEmpty()
  @IsString()
  comuna: string;

  @IsNotEmpty()
  @IsString()
  region: string;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsNumber()
  latitud?: number;

  @IsOptional()
  @IsNumber()
  longitud?: number;

  @IsOptional()
  @IsBoolean()
  esPrincipal?: boolean;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
