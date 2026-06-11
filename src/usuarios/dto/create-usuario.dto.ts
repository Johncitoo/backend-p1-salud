import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateUsuarioDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  identityUserId?: string;

  @IsUUID()
  rolId: string;

  @IsString()
  @Length(1, 20)
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
