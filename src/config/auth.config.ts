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

const isAuthMode = (value: string): value is AuthMode =>
  value === 'mock' || value === 'keycloak';

export const authConfig = registerAs('auth', (): AuthConfig => {
  const authMode = process.env.AUTH_MODE ?? 'mock';

  return {
    mode: isAuthMode(authMode) ? authMode : 'mock',
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
      validateAudience: process.env.KEYCLOAK_VALIDATE_AUDIENCE === 'true',
    },
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  };
});
