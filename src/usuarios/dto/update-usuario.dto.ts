export class UpdateUsuarioDto {
  identityUserId?: string;
  rolId?: string;
  rut?: string;
  nombres?: string;
  apellidos?: string;
  email?: string;
  telefono?: string | null;
  activo?: boolean;
  ultimoAccesoAt?: Date | null;
}
