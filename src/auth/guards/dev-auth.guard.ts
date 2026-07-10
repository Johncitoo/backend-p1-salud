import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import {
  UsuariosService,
  UsuarioPerfil,
} from '../../usuarios/usuarios.service';
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
    // Sin fallback a 'mock': main.ts ya valida al arrancar que AUTH_MODE esté
    // seteada explícitamente, pero este guard no debe volver a introducir un
    // default inseguro si algo cambia en el futuro (ej. un test que instancia
    // el guard sin pasar por bootstrap()).
    const authMode = this.configService.get<string>('AUTH_MODE');
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
      const user =
        await this.usuariosService.findProfileByIdentityUserId(identityUserId);
      if (user) return user;
    }

    if (!mockRole) {
      throw new UnauthorizedException(
        'Header x-identity-user-id o x-mock-role requerido',
      );
    }

    const roleLabel = mockRole.toLowerCase();
    const mockSub = identityUserId ?? `mock-${roleLabel}-id`;

    try {
      const created = await this.usuariosService.findOrCreateFromKeycloak({
        sub: mockSub,
        email: `${mockSub.toLowerCase()}@mock.local`,
        preferredUsername: mockSub,
        rol: mockRole,
      });
      if (created) return created;
    } catch (e) {
      // Silently fall back if DB is not initialized or seeding fails
    }

    return {
      id: `mock-${roleLabel}`,
      identityUserId: identityUserId ?? `mock-${roleLabel}`,
      nombres: 'Usuario',
      apellidos: mockRole.charAt(0) + mockRole.slice(1).toLowerCase(),
      email: `${mockSub.toLowerCase()}@mock.local`,
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
    const preferredUsername =
      typeof payload.preferred_username === 'string'
        ? payload.preferred_username
        : null;

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

  // Mapa rol Keycloak -> rol de la app. Las claves están en minúscula porque
  // comparamos con role.toLowerCase(), así que cubren cualquier combinación de
  // mayúsculas (p.ej. 'tecnico' cubre 'tecnico', 'TECNICO', 'Tecnico').
  // Aceptamos el nombre en inglés y en español porque en producción el Proyecto 12
  // (Identidad/Keycloak) puede nombrar los roles en cualquiera de los dos idiomas.
  private static readonly KEYCLOAK_ROLE_MAP: Record<string, AppRole> = {
    admin: 'ADMIN',
    administrador: 'ADMIN',
    coordinator: 'COORDINADOR',
    coordinador: 'COORDINADOR',
    professional: 'PROFESIONAL',
    profesional: 'PROFESIONAL',
    supervisor: 'SUPERVISOR',
    technician: 'TECNICO',
    tecnico: 'TECNICO',
  };

  // Extrae el rol de aplicación del JWT. Reúne los roles desde el cliente
  // configurado como audience, desde cualquier otro cliente en resource_access y
  // desde los realm roles; así el rol se detecta sin importar si en Keycloak se
  // creó como client role o como realm role. Devuelve el primer rol que
  // corresponda a un rol de la app, ignorando los roles técnicos de Keycloak
  // (default-roles-*, offline_access, uma_authorization, etc.).
  private extractAppRoleFromPayload(payload: JWTPayload): AppRole | null {
    const clientId =
      this.configService.get<string>('KEYCLOAK_AUDIENCE') ?? 'p1';
    const resourceAccess = payload.resource_access as
      | Record<string, { roles?: string[] }>
      | undefined;
    const realmAccess = payload.realm_access as
      | { roles?: string[] }
      | undefined;

    const candidateRoles: string[] = [
      ...(resourceAccess?.[clientId]?.roles ?? []),
      ...Object.values(resourceAccess ?? {}).flatMap(
        (entry) => entry?.roles ?? [],
      ),
      ...(realmAccess?.roles ?? []),
    ];

    for (const role of candidateRoles) {
      const mapped = DevAuthGuard.KEYCLOAK_ROLE_MAP[role.toLowerCase()];
      if (mapped) return mapped;
    }

    return null;
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
    // Seguro por defecto: se valida el "aud" salvo que se desactive
    // explícitamente con 'false'. El realm de Keycloak es compartido entre
    // ~10 proyectos del curso — sin esto, un token válido emitido para OTRO
    // proyecto del mismo realm también sería aceptado acá.
    const validateAudience =
      this.configService.get<string>('KEYCLOAK_VALIDATE_AUDIENCE') !== 'false';

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
    const allowedRoles: AppRole[] = [
      'ADMIN',
      'COORDINADOR',
      'PROFESIONAL',
      'SUPERVISOR',
      'TECNICO',
    ];

    return allowedRoles.includes(normalized as AppRole)
      ? (normalized as AppRole)
      : null;
  }
}
