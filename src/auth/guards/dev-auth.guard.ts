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

    const jwtRole = this.extractAppRoleFromPayload(payload);
    const email = typeof payload.email === 'string' ? payload.email : null;
    const preferredUsername = typeof payload.preferred_username === 'string'
      ? payload.preferred_username : null;

    const user = await this.usuariosService.findOrCreateFromKeycloak({
      sub: payload.sub,
      email,
      preferredUsername,
      rol: jwtRole,
    });

    if (!user) {
      throw new UnauthorizedException('No se pudo autenticar al usuario');
    }

    // El rol del JWT tiene prioridad sobre el de la BD
    if (jwtRole) {
      user.rol = jwtRole;
    }

    return user;
  }

  // Extrae el rol de aplicación desde resource_access.p1.roles del JWT
  // y lo mapea a nuestro sistema (admin → ADMIN, coordinator → COORDINADOR, etc.)
  private extractAppRoleFromPayload(payload: JWTPayload): AppRole | null {
    const clientId = this.configService.get<string>('KEYCLOAK_AUDIENCE') ?? 'p1';
    const resourceAccess = payload.resource_access as
      | Record<string, { roles?: string[] }>
      | undefined;
    const roles = resourceAccess?.[clientId]?.roles ?? [];
    const firstRole = roles[0];

    if (!firstRole) return null;

    return this.mapKeycloakRoleToAppRole(firstRole);
  }

  private mapKeycloakRoleToAppRole(keycloakRole: string): AppRole {
    const map: Record<string, AppRole> = {
      admin: 'ADMIN',
      coordinator: 'COORDINADOR',
      professional: 'PROFESIONAL',
      supervisor: 'SUPERVISOR',
    };

    return map[keycloakRole.toLowerCase()] ?? 'PROFESIONAL';
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
