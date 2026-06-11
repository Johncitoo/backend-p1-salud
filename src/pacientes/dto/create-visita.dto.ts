import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateVisitaDto {
  @IsUUID()
  pacienteId: string;

  @IsOptional()
  @IsUUID()
  planCuidadoId?: string;

  @IsOptional()
  @IsDateString()
  fechaProgramada?: Date;

  @IsOptional()
  @IsString()
  observacion?: string;
}
