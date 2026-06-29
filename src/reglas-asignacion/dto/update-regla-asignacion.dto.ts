import { IsBoolean, IsInt, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateReglaAsignacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsInt()
  prioridad?: number;

  @IsOptional()
  @IsObject()
  condiciones?: Record<string, any>;

  @IsOptional()
  @IsObject()
  acciones?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
