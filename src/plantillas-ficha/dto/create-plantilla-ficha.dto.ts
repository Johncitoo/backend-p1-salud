import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreatePlantillaFichaDto {
  @IsString()
  @Length(1, 100)
  codigo: string;

  @IsString()
  @Length(1, 150)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  tipoAtencion?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @IsOptional()
  @IsUUID()
  creadaPorUsuarioId?: string;
}

export class UpdatePlantillaFichaDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  codigo?: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  tipoAtencion?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
