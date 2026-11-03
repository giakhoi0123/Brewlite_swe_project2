import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (user?: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    const context = createMockContext({ role: UserRole.CUSTOMER });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user role matches required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.BARISTA]);
    const context = createMockContext({ role: UserRole.BARISTA });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when user has CUSTOMER role but BARISTA is required', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.BARISTA]);
    const context = createMockContext({ role: UserRole.CUSTOMER });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when no user is attached to request', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.BARISTA]);
    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
