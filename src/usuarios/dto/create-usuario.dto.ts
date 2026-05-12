export class CreateUsuarioDto {
  identityUserId: string;
  rolId: string;
  rut: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono?: string;
  activo?: boolean;
  ultimoAccesoAt?: Date;
}
