import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

const createContext = (role?: string) =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        user: role ? { rol: role } : undefined,
      }),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  it('allows requests when no roles are required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext('PROFESIONAL'))).toBe(true);
  });

  it('allows users with an allowed role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN', 'SUPERVISOR']),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext('SUPERVISOR'))).toBe(true);
  });

  it('rejects users without the required role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createContext('PROFESIONAL'))).toThrow(
      ForbiddenException,
    );
  });
});
