import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Header('Cache-Control', 'no-store')
  async register(
    @Body() input: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(input);
    response.cookie('brewlite_session', result.accessToken, {
      ...cookieOptions(),
      maxAge: 86400000, // 24 hours
    });
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(input);
    response.cookie('brewlite_session', result.accessToken, {
      ...cookieOptions(),
      maxAge: 86400000, // 24 hours
    });
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('brewlite_session', cookieOptions());
    return { message: 'Đăng xuất thành công' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  async me(@Req() request: AuthenticatedRequest) {
    const user = await this.authService.me(request.user.userId || request.user.id);
    return { user };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async forgotPassword(@Body() input: ForgotPasswordDto) {
    return this.authService.forgotPassword(input);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async resetPassword(@Body() input: ResetPasswordDto) {
    return this.authService.resetPassword(input);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() input: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      request.user.userId || request.user.id,
      input,
    );
  }
}
