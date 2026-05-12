export interface JwtPayload {
  sub: string;
  email?: string;
  rolId?: string;
  [key: string]: unknown;
}
