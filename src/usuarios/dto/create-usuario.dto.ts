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

export class CreateUsuarioDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  identityUserId?: string;

  @IsUUID()
  rolId: string;

  @Transform(({ value }) => formatearRut(value ?? ''))
  @IsRutValido()
  @IsString()
  @Length(9, 12)
  rut: string;

  @IsString()
  @Length(1, 100)
  nombres: string;

  @IsString()
  @Length(1, 100)
  apellidos: string;

  @IsEmail()
  @Length(1, 150)
  email: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  telefono?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsDateString()
  ultimoAccesoAt?: Date;
}
