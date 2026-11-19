import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { DemoLoginDto } from './dto/demo-login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { RegisterEmailDto } from './dto/register-email.dto';
import { LoginEmailDto } from './dto/login-email.dto';
import { VerifyEmailTokenDto } from './dto/verify-email-token.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';

const COOKIE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function setAuthCookie(res: Response, token: string) {
  res.cookie('access_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_TTL_MS,
    path: '/',
  });
}

function clearAuthCookie(res: Response) {
  res.clearCookie('access_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Strict per-IP limits: OTP endpoints are the brute-force / SMS-flooding
  // surface. The per-code attempts counter in AuthService is the second layer.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.phone);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('otp/verify')
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.verifyOtp(dto.phone, dto.code);
    setAuthCookie(res, result.accessToken);
    return result;
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('demo')
  async demoLogin(@Body() dto: DemoLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.demoLogin(dto.phone);
    setAuthCookie(res, result.accessToken);
    return result;
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('google')
  async googleLogin(@Body() dto: GoogleLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.googleLogin(dto.credential);
    setAuthCookie(res, result.accessToken);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: CurrentUserData) {
    return this.authService.me(user.userId);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('email/register')
  registerEmail(@Body() dto: RegisterEmailDto) {
    return this.authService.registerEmail(dto.email, dto.password, dto.name);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('email/login')
  async loginEmail(@Body() dto: LoginEmailDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.loginEmail(dto.email, dto.password);
    setAuthCookie(res, result.accessToken);
    return result;
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('email/verify')
  verifyEmail(@Body() dto: VerifyEmailTokenDto) {
    return this.authService.verifyEmailToken(dto.token);
  }

  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('email/resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto.email);
  }

  // Same low limit as resend-verification: this is the email-flooding /
  // account-enumeration surface for password reset.
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('password/forgot')
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('password/reset')
  async resetPassword(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.resetPassword(dto.token, dto.password);
    setAuthCookie(res, result.accessToken);
    return result;
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Accept token from cookie (web) or Authorization header (mobile)
    const cookieToken = (req.cookies as Record<string, string>)?.access_token;
    const auth = req.headers.authorization;
    const bearerToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    const token = cookieToken ?? bearerToken;
    if (token) await this.authService.logout(token);
    clearAuthCookie(res);
    return { loggedOut: true };
  }
}
