import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { formatearRut } from '../../lib/rut.util';
import { IsRutValido } from '../../lib/rut-validator.decorator';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  identityUserId?: string;

  @IsOptional()
  @IsUUID()
  rolId?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? formatearRut(value) : undefined))
  @IsRutValido()
  @IsString()
  @Length(9, 12)
  rut?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  nombres?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  apellidos?: string;

  @IsOptional()
  @IsEmail()
  @Length(1, 150)
  email?: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  telefono?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsDateString()
  ultimoAccesoAt?: Date | null;
}
