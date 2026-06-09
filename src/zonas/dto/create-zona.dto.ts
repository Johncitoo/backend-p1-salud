import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateZonaDto {
  @IsString()
  @Length(1, 100)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string | null;

  @IsString()
  @Length(1, 100)
  comuna: string;

  @IsString()
  @Length(1, 100)
  region: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
