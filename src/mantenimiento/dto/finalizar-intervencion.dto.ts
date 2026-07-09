import { IsOptional, IsString, MaxLength } from 'class-validator';

// Paso 14: el técnico instaló los componentes (filtro, batería) y registra la
// intervención, cerrando la orden de trabajo.
export class FinalizarIntervencionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notas?: string;
}
