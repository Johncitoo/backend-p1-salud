import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateVariableClinicaDto {
  @IsString()
  @Length(1, 100)
  codigo: string;

  @IsString()
  @Length(1, 150)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsString()
  tipoDato: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  unidad?: string;

  @IsOptional()
  valorMinimo?: number;

  @IsOptional()
  valorMaximo?: number;

  @IsOptional()
  sinonimos?: string[];

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

export class UpdateVariableClinicaDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  codigo?: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsString()
  tipoDato?: string;

  @IsOptional()
  @IsString()
  unidad?: string;

  @IsOptional()
  valorMinimo?: number;

  @IsOptional()
  valorMaximo?: number;

  @IsOptional()
  sinonimos?: string[];

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
