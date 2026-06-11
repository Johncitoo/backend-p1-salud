import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { DevAuthGuard } from './dev-auth.guard';
import { UsuarioPerfil, UsuariosService } from '../../usuarios/usuarios.service';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => 'remote-jwks'),
  jwtVerify: jest.fn(),
}));

const usuarioPerfil: UsuarioPerfil = {
  id: 'usuario-local-id',
  identityUserId: '44f7c9d4-f7c0-41e9-8265-89418d3709af',
  nombres: 'Usuario',
  apellidos: 'Test',
  email: 'test@ucn.cl',
  rol: 'PROFESIONAL',
  activo: true,
};

const createConfigService = (values: Record<string, string>) =>
  ({
    get: jest.fn((key: string) => values[key]),
  }) as unknown as ConfigService;

const createUsuariosService = (user: UsuarioPerfil | null = usuarioPerfil) =>
  ({
    findProfileByIdentityUserId: jest.fn().mockResolvedValue(user),
    linkIdentityUserIdByEmail: jest.fn().mockResolvedValue(user),
  }) as unknown as UsuariosService;

const createContext = (headers: Record<string, string | undefined> = {}) => {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const request: Record<string, unknown> = {
    header: jest.fn((name: string) => normalizedHeaders[name.toLowerCase()]),
    user: undefined,
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return { context, request };
};

describe('DevAuthGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses x-identity-user-id when AUTH_MODE is mock', async () => {
    const usuariosService = createUsuariosService();
    const guard = new DevAuthGuard(
      createConfigService({ AUTH_MODE: 'mock' }),
      usuariosService,
    );
    const { context, request } = createContext({
      'x-identity-user-id': usuarioPerfil.identityUserId,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(usuariosService.findProfileByIdentityUserId).toHaveBeenCalledWith(
      usuarioPerfil.identityUserId,
    );
    expect(request.user).toEqual(usuarioPerfil);
  });

  it('uses x-mock-role when AUTH_MODE is mock and no local user is found', async () => {
    const usuariosService = createUsuariosService(null);
    const guard = new DevAuthGuard(
      createConfigService({ AUTH_MODE: 'mock' }),
      usuariosService,
    );
    const { context, request } = createContext({
      'x-identity-user-id': 'mock-coordinador',
      'x-mock-role': 'COORDINADOR',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(
      expect.objectContaining({
        identityUserId: 'mock-coordinador',
        rol: 'COORDINADOR',
        activo: true,
      }),
    );
  });

  it('requires x-identity-user-id or x-mock-role when AUTH_MODE is mock', async () => {
    const guard = new DevAuthGuard(
      createConfigService({ AUTH_MODE: 'mock' }),
      createUsuariosService(),
    );
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Header x-identity-user-id o x-mock-role requerido',
    );
  });

  it('requires Authorization Bearer when AUTH_MODE is keycloak', async () => {
    const guard = new DevAuthGuard(
      createConfigService({
        AUTH_MODE: 'keycloak',
        KEYCLOAK_ISSUER: 'http://localhost/realms/sistema-centralizado',
        KEYCLOAK_JWKS_URI:
          'http://localhost/realms/sistema-centralizado/protocol/openid-connect/certs',
      }),
      createUsuariosService(),
    );
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Authorization Bearer token requerido',
    );
  });

  it('validates a Keycloak token and resolves the local profile by JWT sub', async () => {
    jest.mocked(jwtVerify).mockResolvedValue({
      payload: {
        sub: usuarioPerfil.identityUserId,
      },
      protectedHeader: { alg: 'RS256' },
      key: new Uint8Array(),
    } as unknown as Awaited<ReturnType<typeof jwtVerify>>);

    const usuariosService = createUsuariosService();
    const guard = new DevAuthGuard(
      createConfigService({
        AUTH_MODE: 'keycloak',
        KEYCLOAK_ISSUER: 'http://localhost/realms/sistema-centralizado',
        KEYCLOAK_JWKS_URI:
          'http://localhost/realms/sistema-centralizado/protocol/openid-connect/certs',
        KEYCLOAK_AUDIENCE: 'salud-domiciliaria-api',
        KEYCLOAK_VALIDATE_AUDIENCE: 'false',
      }),
      usuariosService,
    );
    const { context, request } = createContext({
      authorization: 'Bearer access-token',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(createRemoteJWKSet).toHaveBeenCalledWith(
      new URL(
        'http://localhost/realms/sistema-centralizado/protocol/openid-connect/certs',
      ),
    );
    expect(jwtVerify).toHaveBeenCalledWith('access-token', 'remote-jwks', {
      issuer: 'http://localhost/realms/sistema-centralizado',
      audience: undefined,
    });
    expect(usuariosService.findProfileByIdentityUserId).toHaveBeenCalledWith(
      usuarioPerfil.identityUserId,
    );
    expect(request.user).toEqual(usuarioPerfil);
  });

  it('links a local user by email when JWT sub is not stored yet', async () => {
    jest.mocked(jwtVerify).mockResolvedValue({
      payload: {
        sub: usuarioPerfil.identityUserId,
        email: usuarioPerfil.email,
      },
      protectedHeader: { alg: 'RS256' },
      key: new Uint8Array(),
    } as unknown as Awaited<ReturnType<typeof jwtVerify>>);

    const usuariosService = createUsuariosService(null);
    jest
      .mocked(usuariosService.linkIdentityUserIdByEmail)
      .mockResolvedValue(usuarioPerfil);

    const guard = new DevAuthGuard(
      createConfigService({
        AUTH_MODE: 'keycloak',
        KEYCLOAK_ISSUER: 'http://localhost/realms/sistema-centralizado',
        KEYCLOAK_JWKS_URI:
          'http://localhost/realms/sistema-centralizado/protocol/openid-connect/certs',
      }),
      usuariosService,
    );
    const { context, request } = createContext({
      authorization: 'Bearer access-token',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(usuariosService.linkIdentityUserIdByEmail).toHaveBeenCalledWith(
      usuarioPerfil.email,
      usuarioPerfil.identityUserId,
    );
    expect(request.user).toEqual(usuarioPerfil);
  });

  it('rejects a valid Keycloak token without sub', async () => {
    jest.mocked(jwtVerify).mockResolvedValue({
      payload: {},
      protectedHeader: { alg: 'RS256' },
      key: new Uint8Array(),
    } as unknown as Awaited<ReturnType<typeof jwtVerify>>);

    const guard = new DevAuthGuard(
      createConfigService({
        AUTH_MODE: 'keycloak',
        KEYCLOAK_ISSUER: 'http://localhost/realms/sistema-centralizado',
        KEYCLOAK_JWKS_URI:
          'http://localhost/realms/sistema-centralizado/protocol/openid-connect/certs',
      }),
      createUsuariosService(),
    );
    const { context } = createContext({
      authorization: 'Bearer access-token',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Token Keycloak sin sub',
    );
  });
});
