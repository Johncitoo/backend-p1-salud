import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class UpdateDisponibilidadDto {
  @IsOptional()
  @IsUUID()
  zonaId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  diaSemana?: number;

  @IsOptional()
  @IsString()
  horaInicio?: string;

  @IsOptional()
  @IsString()
  horaFin?: string;

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
