import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateDisponibilidadDto {
  @IsUUID()
  profesionalSaludId: string;

  @IsOptional()
  @IsUUID()
  zonaId?: string | null;

  @IsInt()
  @Min(1)
  @Max(7)
  diaSemana: number;

  @IsString()
  horaInicio: string;

  @IsString()
  horaFin: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacidadMaxVisitas?: number | null;

  @IsOptional()
  @IsString()
  vigenteDesde?: string | null;

  @IsOptional()
  @IsString()
  vigenteHasta?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
