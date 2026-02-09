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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: { id: string; email: string }) {
    return this.authService.getMe(user.id);
  }
}
