import { IsBoolean, IsOptional } from 'class-validator';

export class CompletarVisitaDto {
  @IsOptional()
  @IsBoolean()
  puntual?: boolean;
}
