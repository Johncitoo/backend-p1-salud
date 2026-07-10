import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateBloqueoAgendaDto {
  @IsOptional()
  @IsIn(['GENERAL', 'PROFESIONAL', 'ZONA'])
  tipo?: string;

  @IsOptional()
  @IsUUID()
  profesionalSaludId?: string;

  @IsOptional()
  @IsUUID()
  zonaId?: string;

  @IsOptional()
  @IsDateString()
  fechaHoraInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaHoraFin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  motivo?: string;

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsOptional()
  @IsIn(['ACTIVO', 'CANCELADO'])
  estado?: string;

  @IsOptional()
  @IsUUID()
  canceladoPorUsuarioId?: string;

  @IsOptional()
  @IsDateString()
  canceladoAt?: string;
}
