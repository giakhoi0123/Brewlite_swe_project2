import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    passwordResetToken: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
  };

  const mockUser = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    fullName: 'Test User',
    passwordHash: '',
    role: UserRole.CUSTOMER,
    sessionVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('Password123!', 10);
  });

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return 'test-jwt-secret';
              if (key === 'JWT_EXPIRES_IN') return '1d';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully and return public user + accessToken', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'new@example.com',
        fullName: 'New User',
        password: 'Password123!',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'new@example.com' },
      });
      expect(prisma.user.create).toHaveBeenCalled();
      expect(result.user.email).toBe(mockUser.email);
      expect(result.accessToken).toBe('signed-jwt-token');
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it('should throw ConflictException if email is already taken', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          fullName: 'Test User',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if fullName/name is empty', async () => {
      await expect(
        service.register({
          email: 'noname@example.com',
          password: 'Password123!',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result.user.id).toBe(mockUser.id);
      expect(result.accessToken).toBe('signed-jwt-token');
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'notfound@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('me', () => {
    it('should return user info when user exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.me(mockUser.id);
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.me('nonexistent-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('forgotPassword & resetPassword', () => {
    it('should generate reset token for existing user without revealing presence', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.passwordResetToken.create.mockResolvedValue({});

      const res = await service.forgotPassword({ email: 'test@example.com' });
      expect(res.message).toContain('đặt lại mật khẩu');
      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    });

    it('should return same message for non-existing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await service.forgotPassword({ email: 'unknown@example.com' });
      expect(res.message).toContain('đặt lại mật khẩu');
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('should reset password successfully with valid token', async () => {
      const rawToken = 'valid-token';
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      prisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-id-1',
        userId: mockUser.id,
        tokenHash,
        used: false,
        expiresAt: new Date(Date.now() + 100000),
        user: mockUser,
      });

      const res = await service.resetPassword({
        token: rawToken,
        newPassword: 'NewPassword123!',
      });

      expect(res.message).toContain('Đặt lại mật khẩu thành công');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if token is invalid or expired', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'invalid-token',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully when current password is valid', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({});

      const res = await service.changePassword(mockUser.id, {
        currentPassword: 'Password123!',
        newPassword: 'BrandNewPassword123!',
      });

      expect(res.message).toContain('Đổi mật khẩu thành công');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            sessionVersion: { increment: 1 },
          }),
        }),
      );
    });

    it('should throw BadRequestException when current password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.changePassword(mockUser.id, {
          currentPassword: 'WrongPassword!',
          newPassword: 'BrandNewPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
