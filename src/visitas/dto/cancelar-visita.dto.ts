import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CancelarVisitaDto {
  @IsOptional()
  @IsUUID()
  motivoCancelacionId?: string;

  @IsOptional()
  @IsString()
  observacionCancelacion?: string;
}
