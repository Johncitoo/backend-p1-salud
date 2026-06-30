import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateMotivoReprogramacionDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string | null;

  @IsOptional()
  @IsBoolean()
  requiereObservacion?: boolean;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
