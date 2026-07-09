import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// Repuesto detectado por el técnico durante la inspección de mantenimiento
// (ej: filtro HEPA, batería de respaldo). Se usa para generar automáticamente
// el pedido de repuestos en Proyecto 3 (Gestión de Pedidos).
export class RepuestoInspeccionDto {
  @IsString()
  @Length(1, 150)
  nombre: string;

  @IsInt()
  @Min(1)
  cantidad: number;
}

// Paso 9 del UAT: el técnico inspecciona el equipo, registra el diagnóstico
// (informe técnico) y los repuestos a reemplazar. Al registrarla se emite el
// evento MaintenanceInspectionCompleted y se dispara el pedido de repuestos.
export class InspeccionMantenimientoDto {
  @IsString()
  @MinLength(1)
  diagnostico: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RepuestoInspeccionDto)
  repuestos: RepuestoInspeccionDto[];
}
