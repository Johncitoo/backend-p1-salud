import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class UpdateProfesionalDto {
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  profesion?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  numeroRegistro?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
