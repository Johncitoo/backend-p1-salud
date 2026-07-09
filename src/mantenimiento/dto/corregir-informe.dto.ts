import { IsOptional, IsString, Length, MinLength } from 'class-validator';

// Paso 19 del UAT: corrección del informe técnico. El técnico actualiza el
// diagnóstico (p.ej. un número de serie incorrecto) y el sistema emite una nueva
// versión del documento, conservando la anterior en el historial.
export class CorregirInformeDto {
  @IsString()
  @MinLength(1)
  diagnostico: string;

  // Opcional: permite corregir también el equipo si venía mal escrito.
  @IsOptional()
  @IsString()
  @Length(1, 150)
  equipo?: string;

  // Motivo de la corrección (para trazabilidad en el historial de versiones).
  @IsOptional()
  @IsString()
  @Length(1, 500)
  motivo?: string;
}
