import { IsDate, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMedicionClinicaDto {
  @IsOptional()
  @IsUUID()
  fichaClinicaId?: string;

  @IsOptional()
  @IsUUID()
  visitaId?: string;

  @IsUUID()
  pacienteId: string;

  @IsUUID()
  variableClinicaId: string;

  @IsOptional()
  @IsNumber()
  valorNumero?: number;

  @IsOptional()
  @IsString()
  valorTexto?: string;

  @IsOptional()
  valorBoolean?: boolean;

  @IsOptional()
  @IsDate()
  valorFecha?: Date;

  @IsOptional()
  @IsObject()
  valorJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  unidad?: string;

  @IsOptional()
  @IsString()
  origen?: string;

  @IsOptional()
  fechaMedicion?: Date;
}

export class UpdateMedicionClinicaDto {
  @IsOptional()
  @IsNumber()
  valorNumero?: number;

  @IsOptional()
  @IsString()
  valorTexto?: string;

  @IsOptional()
  valorBoolean?: boolean;

  @IsOptional()
  @IsDate()
  valorFecha?: Date;

  @IsOptional()
  @IsObject()
  valorJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  unidad?: string;

  @IsOptional()
  @IsString()
  origen?: string;

  @IsOptional()
  fechaMedicion?: Date;
}
