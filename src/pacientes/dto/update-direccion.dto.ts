import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateDireccionDto {
	@IsOptional()
	@IsUUID()
	pacienteId?: string;

	@IsOptional()
	@IsString()
	alias?: string;

	@IsOptional()
	@IsString()
	calle?: string;

	@IsOptional()
	@IsString()
	numero?: string;

	@IsOptional()
	@IsString()
	departamento?: string;

	@IsOptional()
	@IsString()
	comuna?: string;

	@IsOptional()
	@IsString()
	region?: string;

	@IsOptional()
	@IsNumber()
	latitud?: number;

	@IsOptional()
	@IsNumber()
	longitud?: number;

	@IsOptional()
	@IsBoolean()
	esPrincipal?: boolean;
}
