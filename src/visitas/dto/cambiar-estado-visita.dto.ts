import { IsIn } from 'class-validator';

const VISITA_ESTADOS = ['PROGRAMADA', 'EN_CAMINO', 'EN_ATENCION', 'REALIZADA', 'CANCELADA', 'REPROGRAMADA', 'NO_REALIZADA'] as const;

export class CambiarEstadoVisitaDto {
  @IsIn(VISITA_ESTADOS)
  estado: string;
}
