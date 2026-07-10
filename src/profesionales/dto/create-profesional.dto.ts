import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateProfesionalDto {
  @IsUUID()
  usuarioId: string;

  @IsString()
  @Length(1, 50)
  profesion: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  numeroRegistro?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  especialidadIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  zonaIds?: string[];
}
