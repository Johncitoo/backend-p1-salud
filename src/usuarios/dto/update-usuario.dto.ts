import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  identityUserId?: string;

  @IsOptional()
  @IsUUID()
  rolId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
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
