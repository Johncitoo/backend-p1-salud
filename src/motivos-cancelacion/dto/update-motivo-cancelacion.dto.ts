import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class UpdateMotivoCancelacionDto {
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
  @IsIn(['VISITA', 'PLAN_CUIDADO', 'PRESTACION', 'GENERAL'])
  aplicaA?: string;

  @IsOptional()
  @IsBoolean()
  requiereObservacion?: boolean;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
