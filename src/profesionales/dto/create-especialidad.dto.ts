import { IsOptional, IsString, Length } from 'class-validator';

export class CreateEspecialidadDto {
  @IsString()
  @Length(1, 100)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string | null;
}
