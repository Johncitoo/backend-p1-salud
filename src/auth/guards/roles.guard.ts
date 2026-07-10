import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, type AppRole } from '../decorators/roles.decorator';
import type { UsuarioPerfil } from '../../usuarios/usuarios.service';

type RequestWithUser = {
  user?: UsuarioPerfil;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userRole = request.user?.rol as AppRole | undefined;

    if (userRole && requiredRoles.includes(userRole)) return true;

    throw new ForbiddenException(
      'No tienes permisos para realizar esta accion',
    );
  }
}
