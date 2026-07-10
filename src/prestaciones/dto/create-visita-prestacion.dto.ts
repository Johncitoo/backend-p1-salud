import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateVisitaPrestacionDto {
  @IsUUID()
  prestacionId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  cantidad?: number;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  estado?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}

export class UpdateVisitaPrestacionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  cantidad?: number;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  estado?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}
