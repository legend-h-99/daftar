import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';

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
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('demo')
  demoLogin(@Body() dto: DemoLoginDto) {
    return this.authService.demoLogin(dto.phone);
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('google')
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto.credential);
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
  loginEmail(@Body() dto: LoginEmailDto) {
    return this.authService.loginEmail(dto.email, dto.password);
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

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: Request) {
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token) await this.authService.logout(token);
    return { loggedOut: true };
  }
}
