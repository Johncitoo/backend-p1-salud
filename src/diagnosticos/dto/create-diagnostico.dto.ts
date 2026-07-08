import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateDiagnosticoDto {
  @IsUUID()
  visitaId: string;

  @IsString()
  @MinLength(1)
  descripcion: string;
}
