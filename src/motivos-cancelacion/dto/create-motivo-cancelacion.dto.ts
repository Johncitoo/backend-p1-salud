import { IsBoolean, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateMotivoCancelacionDto {
  @IsString()
  @Length(1, 50)
  codigo: string;

  @IsString()
  @MaxLength(150)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string | null;

  @IsOptional()
  @IsIn(['VISITA', 'PLAN_CUIDADO', 'PRESTACION', 'GENERAL'])
  aplicaA?: string;

  @IsOptional()
  @IsBoolean()
  requiereObservacion?: boolean;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
