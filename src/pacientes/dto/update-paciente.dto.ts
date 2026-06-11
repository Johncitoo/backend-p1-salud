import { IsDateString, IsEmail, IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { formatearRut } from '../../lib/rut.util';
import { IsRutValido } from '../../lib/rut-validator.decorator';

export class UpdatePacienteDto {
	@IsOptional()
	@IsString()
	@Length(1, 100)
	nombres?: string;

	@IsOptional()
	@IsString()
	@Length(1, 100)
	apellidos?: string;

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
	@Transform(({ value }) => (value ? formatearRut(value) : undefined))
	@IsRutValido()
	@IsString()
	@Length(9, 12)
	rut?: string;

	@IsOptional()
	@IsString()
	direccion?: string | null;
}
