import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export type AppRole = 'ADMIN' | 'COORDINADOR' | 'PROFESIONAL' | 'SUPERVISOR' | 'TECNICO';

export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
