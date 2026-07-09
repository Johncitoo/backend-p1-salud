import { registerAs } from '@nestjs/config';

export type AuthMode = 'mock' | 'keycloak';

export interface AuthConfig {
  mode: AuthMode;
  jwt: {
    secret?: string;
    issuer?: string;
    audience?: string;
  };
  keycloak: {
    realm: string;
    issuer: string;
    jwksUri: string;
    audience: string;
    validateAudience: boolean;
  };
  frontendUrl: string;
}

const isAuthMode = (value: string | undefined): value is AuthMode =>
  value === 'mock' || value === 'keycloak';

export const authConfig = registerAs('auth', (): AuthConfig => {
  // Sin fallback a 'mock' aquí tampoco: main.ts (validateAuthMode) ya impide
  // arrancar sin AUTH_MODE seteada explícitamente. Este objeto de config no
  // se usa hoy en runtime (DevAuthGuard lee la variable de entorno directo),
  // pero no debe modelar un default inseguro si en el futuro alguien empieza
  // a inyectarlo.
  const authMode = process.env.AUTH_MODE;

  return {
    mode: isAuthMode(authMode) ? authMode : 'keycloak',
    jwt: {
      secret: process.env.JWT_SECRET,
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    },
    keycloak: {
      realm: process.env.KEYCLOAK_REALM ?? 'sistema-centralizado',
      issuer:
        process.env.KEYCLOAK_ISSUER ??
        'http://localhost/realms/sistema-centralizado',
      jwksUri:
        process.env.KEYCLOAK_JWKS_URI ??
        'http://localhost/realms/sistema-centralizado/protocol/openid-connect/certs',
      audience: process.env.KEYCLOAK_AUDIENCE ?? 'salud-domiciliaria-api',
      // Seguro por defecto (ver dev-auth.guard.ts): se valida el "aud" salvo
      // que se desactive explícitamente con 'false'.
      validateAudience: process.env.KEYCLOAK_VALIDATE_AUDIENCE !== 'false',
    },
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  };
});
