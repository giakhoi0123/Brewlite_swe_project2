import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    me: jest.Mock;
    forgotPassword: jest.Mock;
    resetPassword: jest.Mock;
    changePassword: jest.Mock;
  };

  const mockResponse = () => {
    const res: any = {};
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      me: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register user and set cookie', async () => {
      const authResult = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          fullName: 'Test User',
          role: UserRole.CUSTOMER,
        },
        accessToken: 'mock-jwt-token',
      };
      authService.register.mockResolvedValue(authResult);

      const res = mockResponse();
      const result = await controller.register(
        {
          email: 'test@example.com',
          fullName: 'Test User',
          password: 'Password123!',
        },
        res,
      );

      expect(authService.register).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith(
        'brewlite_session',
        'mock-jwt-token',
        expect.any(Object),
      );
      expect(result).toEqual(authResult);
    });
  });

  describe('login', () => {
    it('should login user and set cookie', async () => {
      const authResult = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          fullName: 'Test User',
          role: UserRole.CUSTOMER,
        },
        accessToken: 'mock-jwt-token',
      };
      authService.login.mockResolvedValue(authResult);

      const res = mockResponse();
      const result = await controller.login(
        {
          email: 'test@example.com',
          password: 'Password123!',
        },
        res,
      );

      expect(authService.login).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith(
        'brewlite_session',
        'mock-jwt-token',
        expect.any(Object),
      );
      expect(result).toEqual(authResult);
    });
  });

  describe('logout', () => {
    it('should clear cookie on logout', () => {
      const res = mockResponse();
      const result = controller.logout(res);

      expect(res.clearCookie).toHaveBeenCalledWith(
        'brewlite_session',
        expect.any(Object),
      );
      expect(result.message).toBe('Đăng xuất thành công');
    });
  });

  describe('me', () => {
    it('should return current user profile', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Test User',
        role: UserRole.CUSTOMER,
      };
      authService.me.mockResolvedValue(user);

      const req: any = { user: { userId: 'user-1' } };
      const result = await controller.me(req);

      expect(authService.me).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ user });
    });
  });
});
