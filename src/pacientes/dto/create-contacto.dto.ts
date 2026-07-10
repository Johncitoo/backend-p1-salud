import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateContactoDto {
  @IsUUID()
  pacienteId: string;

  @IsString()
  nombre: string;

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
