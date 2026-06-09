export const createRemoteJWKSet = jest.fn(() => 'remote-jwks');

export const jwtVerify = jest.fn();

export type JWTPayload = Record<string, unknown>;
