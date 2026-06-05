import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UsuarioPerfil } from '../../usuarios/usuarios.service';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioPerfil | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: UsuarioPerfil }>();
    return request.user;
  },
);
