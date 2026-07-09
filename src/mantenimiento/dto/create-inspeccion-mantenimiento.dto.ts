import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class RepuestoSolicitadoDto {
  @IsString()
  @MaxLength(60)
  sku: string;

  @IsInt()
  @Min(1)
  cantidad: number;
}

export class CreateInspeccionMantenimientoDto {
  @IsOptional()
  @IsUUID()
  pacienteId?: string;

  @IsOptional()
  @IsUUID()
  visitaId?: string;

  @IsString()
  @MaxLength(150)
  equipo: string;

  @IsOptional()
  @IsString()
  diagnostico?: string;

  @IsOptional()
  @IsIn(['baja', 'media', 'alta', 'urgente'])
  prioridad?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RepuestoSolicitadoDto)
  repuestos: RepuestoSolicitadoDto[];
}
