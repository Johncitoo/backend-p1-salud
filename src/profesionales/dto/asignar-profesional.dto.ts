import { IsOptional, IsUUID } from 'class-validator';

export class AsignarProfesionalDto {
  @IsOptional()
  @IsUUID()
  zonaId?: string;

  @IsOptional()
  @IsUUID()
  especialidadId?: string;
}
