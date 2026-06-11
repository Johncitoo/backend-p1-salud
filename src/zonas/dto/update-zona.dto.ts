import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateZonaDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  comuna?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  region?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
