import { Controller, Post, Get, Body, UseGuards, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { Response } from 'express';
import { buildAuthCookieOptions } from './auth-cookie.util';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

/**
 * AuthController - Handles authentication endpoints.
 *
 * Endpoints:
 * - POST /auth/login - Login with email/password
 * - POST /auth/refresh - Rotate refresh token
 * - POST /auth/logout - Revoke refresh token
 * - POST /auth/reset-password-request - Request password reset token
 * - POST /auth/reset-password - Reset password with token
 * - GET /auth/me - Get current user info (requires JWT)
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập hệ thống' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'JWT + exchange session token' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto.email, dto.password);

    res.cookie('access_token', tokens.accessToken, buildAuthCookieOptions(900000));

    res.cookie(
      'exchange_session',
      tokens.exchangeAccessToken,
      buildAuthCookieOptions(3600000),
    );

    return tokens;
  }

  @Post('register')
  @ApiOperation({ summary: 'Tạo tài khoản hệ thống' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Tạo user thành công' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.name);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Lấy thông tin user hiện tại' })
  @ApiResponse({ status: 200, description: 'Thông tin user' })
  async getMe(@CurrentUser() user: { id: string; email: string }) {
    return this.authService.getMe(user.id);
  }
}
