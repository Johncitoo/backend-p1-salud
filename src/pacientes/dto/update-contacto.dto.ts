import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateContactoDto {
	@IsOptional()
	@IsUUID()
	pacienteId?: string;

	@IsOptional()
	@IsString()
	nombre?: string;

	@IsOptional()
	@IsString()
	telefono?: string;

	@IsOptional()
	@IsEmail()
	email?: string;

	@IsOptional()
	@IsString()
	relacion?: string;

	@IsOptional()
	@IsBoolean()
	esEmergencia?: boolean;
}
