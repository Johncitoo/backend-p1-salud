import { IsDateString, IsEmail, IsOptional, IsString, Length } from 'class-validator';

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
	@IsString()
	@Length(1, 20)
	rut?: string;

	@IsOptional()
	@IsString()
	direccion?: string | null;
}
