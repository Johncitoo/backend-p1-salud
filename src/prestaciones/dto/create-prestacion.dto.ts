import { IsBoolean, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreatePrestacionDto {
  @IsString()
  @Length(1, 50)
  codigo: string;

  @IsString()
  @Length(1, 150)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  duracionEstimadaMin?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

export class UpdatePrestacionDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  codigo?: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  duracionEstimadaMin?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
