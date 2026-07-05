import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBloqueoAgendaDto {
  @IsIn(['GENERAL', 'PROFESIONAL', 'ZONA'])
  tipo: string;

  @IsOptional()
  @IsUUID()
  profesionalSaludId?: string;

  @IsOptional()
  @IsUUID()
  zonaId?: string;

  @IsDateString()
  fechaHoraInicio: string;

  @IsDateString()
  fechaHoraFin: string;

  @IsString()
  @MaxLength(150)
  motivo: string;

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsOptional()
  @IsIn(['ACTIVO', 'CANCELADO'])
  estado?: string;
}
