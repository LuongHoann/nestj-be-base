import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

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
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const { accessToken, refreshToken } = await this.authService.login(
      dto.email,
      dto.password
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  async refresh(@Body('refreshToken') refreshToken: string) {
    const tokens = await this.authService.rotateRefreshToken(refreshToken);
    return tokens;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Body('refreshToken') refreshToken: string) {
    await this.authService.revokeRefreshToken(refreshToken);
    return { message: 'Đăng xuất thành công !' };
  }

  @Post('reset-password-request')
  async requestPasswordReset(@Body('email') email: string) {
    // TODO: Find user by email and create reset token
    // For now, this is a placeholder
    return { message: 'Yêu cầu thay đổi mật khẩu đã được gửi !' };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Mật khẩu đã được thay đổi !' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: { id: number; email: string }) {
    return this.authService.getMe(user.id);
  }
}
