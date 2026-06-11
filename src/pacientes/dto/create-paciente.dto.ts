import { IsDateString, IsEmail, IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { formatearRut } from '../../lib/rut.util';
import { IsRutValido } from '../../lib/rut-validator.decorator';

export class CreatePacienteDto {
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

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: Date;

  @IsOptional()
  @IsString()
  sexo?: string;

  @IsOptional()
  @IsString()
  telefono?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  direccion?: string | null;
}
