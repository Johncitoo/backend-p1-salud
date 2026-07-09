import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateMedicamentoCatalogoDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  nombre?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  presentacion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
