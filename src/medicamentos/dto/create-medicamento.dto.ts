import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateMedicamentoDto {
  @IsUUID()
  visitaId: string;

  @IsUUID()
  medicamentoCatalogoId: string;

  @IsInt()
  @Min(1)
  cantidadCajas: number;

  @IsOptional()
  @IsString()
  indicaciones?: string;
}
