import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePlanDto {
  @IsUUID()
  pacienteId: string;

  @IsOptional()
  @IsString()
  objetivo?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsDateString()
  fechaInicio?: Date;

  @IsOptional()
  @IsDateString()
  fechaFin?: Date;

  @IsOptional()
  @IsString()
  estado?: string;
}
