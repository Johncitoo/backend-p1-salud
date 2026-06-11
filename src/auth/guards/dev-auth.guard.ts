import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { UsuariosService, UsuarioPerfil } from '../../usuarios/usuarios.service';
import type { AppRole } from '../decorators/roles.decorator';

type RequestWithUser = Request & {
  user?: UsuarioPerfil;
};

@Injectable()
export class DevAuthGuard implements CanActivate {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly configService: ConfigService,
    private readonly usuariosService: UsuariosService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authMode = this.configService.get<string>('AUTH_MODE') ?? 'mock';
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (authMode === 'mock') {
      request.user = await this.getMockUser(request);
      return true;
    }

    if (authMode === 'keycloak') {
      request.user = await this.getKeycloakUser(request);
      return true;
    }

    throw new UnauthorizedException('AUTH_MODE invalido');
  }

  private async getMockUser(request: Request): Promise<UsuarioPerfil> {
    const identityUserId = request.header('x-identity-user-id');
    const mockRole = this.normalizeMockRole(request.header('x-mock-role'));

    if (identityUserId) {
      const user = await this.usuariosService.findProfileByIdentityUserId(identityUserId);
      if (user) return user;
    }

    if (!mockRole) {
      throw new UnauthorizedException('Header x-identity-user-id o x-mock-role requerido');
    }

    const roleLabel = mockRole.toLowerCase();

    return {
      id: `mock-${roleLabel}`,
      identityUserId: identityUserId ?? `mock-${roleLabel}`,
      nombres: 'Usuario',
      apellidos: mockRole.charAt(0) + mockRole.slice(1).toLowerCase(),
      email: `${roleLabel}@mock.local`,
      rol: mockRole,
      activo: true,
    };
  }

  private async getKeycloakUser(request: Request): Promise<UsuarioPerfil> {
    const token = this.extractBearerToken(request);
    const payload = await this.verifyKeycloakToken(token);

    if (!payload.sub) {
      throw new UnauthorizedException('Token Keycloak sin sub');
    }

    const user = await this.usuariosService.findProfileByIdentityUserId(payload.sub);

    if (user) return user;

    const email = typeof payload.email === 'string' ? payload.email : null;
    const linkedUser = email
      ? await this.usuariosService.linkIdentityUserIdByEmail(email, payload.sub)
      : null;

    if (!linkedUser) {
      throw new UnauthorizedException('Usuario local no encontrado o inactivo');
    }

    return linkedUser;
  }

  private extractBearerToken(request: Request): string {
    const authorization = request.header('authorization');
    const [type, token] = authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Authorization Bearer token requerido');
    }

    return token;
  }

  private async verifyKeycloakToken(token: string): Promise<JWTPayload> {
    const issuer = this.configService.get<string>('KEYCLOAK_ISSUER');
    const jwksUri = this.configService.get<string>('KEYCLOAK_JWKS_URI');
    const audience = this.configService.get<string>('KEYCLOAK_AUDIENCE');
    const validateAudience = this.configService.get<string>('KEYCLOAK_VALIDATE_AUDIENCE') === 'true';

    if (!issuer || !jwksUri) {
      throw new UnauthorizedException('Configuracion Keycloak incompleta');
    }

    try {
      if (!this.jwks) {
        this.jwks = createRemoteJWKSet(new URL(jwksUri));
      }

      const { payload } = await jwtVerify(token, this.jwks, {
        issuer,
        audience: validateAudience ? audience : undefined,
      });

      return payload;
    } catch {
      throw new UnauthorizedException('Token Keycloak invalido');
    }
  }

  private normalizeMockRole(role?: string): AppRole | null {
    const normalized = role?.trim().toUpperCase();
    const allowedRoles: AppRole[] = ['ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR'];

    return allowedRoles.includes(normalized as AppRole) ? (normalized as AppRole) : null;
  }
}
