import { randomBytes, randomInt, randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common/types/auth.types';
import { EmailService } from './email.service';

const EMAIL_VERIFY_TTL_MINUTES = 15;
const EMAIL_CODE_MAX_ATTEMPTS = 5;

const OTP_TTL_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;

const DEMO_BUSINESSES: Record<string, { name: string; city: string }> = {
  '+966500000001': { name: 'مطبخ أم سلطان', city: 'الرياض' },
  '+966500000002': { name: 'مخبزة بيت الخبز', city: 'جدة' },
  '+966500000003': { name: 'حلويات أم يوسف', city: 'مكة' },
  '+966500000004': { name: 'ورشة العود والبخور', city: 'الدمام' },
  '+966500000005': { name: 'خياطة الأناقة', city: 'الرياض' },
  '+966500000006': { name: 'صابون الطبيعة', city: 'بريدة' },
  '+966500000007': { name: 'شموع ولمسات', city: 'الخبر' },
  '+966500000008': { name: 'بُنّ الديار', city: 'الرياض' },
};

/**
 * MOCK AUTH FLOW — there is no real SMS provider wired up for this MVP.
 * The generated code is exposed as `devCode` in the API response ONLY when
 * AUTH_DEV_OTP=true (local dev / demos). Any deployment without that flag is
 * safe by default: the code is generated but never returned. Replace with a
 * real SMS gateway (e.g. Unifonic, Taqnyat) for production.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly devOtpEnabled: boolean;
  private readonly demoAuthEnabled: boolean;
  private readonly googleClientId?: string;
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    configService: ConfigService,
  ) {
    this.devOtpEnabled = configService.get<string>('AUTH_DEV_OTP') === 'true';
    this.demoAuthEnabled = configService.get<string>('DEMO_AUTH_ENABLED') === 'true';
    this.googleClientId = configService.get<string>('GOOGLE_CLIENT_ID');

    const allowedEnvs = new Set(['development', 'test']);
    if (this.devOtpEnabled && !allowedEnvs.has(configService.get<string>('NODE_ENV') ?? '')) {
      throw new Error(
        'AUTH_DEV_OTP is only allowed when NODE_ENV is "development" or "test". ' +
        'Remove AUTH_DEV_OTP or set it to false in this environment.',
      );
    }
  }

  private generateCode(): string {
    // crypto.randomInt is a CSPRNG; Math.random() output is predictable.
    return randomInt(100000, 1000000).toString();
  }

  /**
   * Canonicalizes Saudi phone numbers to "+966XXXXXXXXX" so "0500000001",
   * "500000001" and "+966500000001" all resolve to the same User/Business —
   * otherwise the same person could end up with duplicate accounts depending
   * on which format a given client happens to send.
   */
  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('966')) return `+${digits}`;
    if (digits.startsWith('0')) return `+966${digits.slice(1)}`;
    return `+966${digits}`;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async recordAuthEvent(params: {
    action: string;
    success?: boolean;
    userId?: string | null;
    businessId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: params.action,
          success: params.success ?? true,
          userId: params.userId ?? undefined,
          businessId: params.businessId ?? undefined,
          metadata: params.metadata,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to write auth audit log for ${params.action}: ${String(error)}`);
    }
  }

  async requestOtp(phoneInput: string) {
    const phone = this.normalizePhone(phoneInput);
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // One live code per phone: requesting a new code invalidates older ones.
    await this.prisma.otpCode.updateMany({
      where: { phone, consumed: false },
      data: { consumed: true },
    });
    await this.prisma.otpCode.create({
      data: { phone, code, expiresAt },
    });

    await this.recordAuthEvent({ action: 'OTP_REQUESTED', metadata: { phone } });

    if (this.devOtpEnabled) {
      this.logger.warn(`AUTH_DEV_OTP is on — returning OTP for ${phone} in the response`);
      return { sent: true, devCode: code };
    }
    // TODO: hand the code to the SMS gateway here.
    return { sent: true };
  }

  async verifyOtp(phoneInput: string, code: string) {
    const phone = this.normalizePhone(phoneInput);
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, consumed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      await this.recordAuthEvent({ action: 'OTP_LOGIN_FAILED', success: false, metadata: { phone, reason: 'missing_or_expired_code' } });
      throw new BadRequestException('Invalid or expired verification code');
    }

    if (otp.code !== code) {
      // Count the failure; kill the code entirely after OTP_MAX_ATTEMPTS so
      // a 6-digit code can't be brute-forced within its 5-minute lifetime.
      const updated = await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      if (updated.attempts >= OTP_MAX_ATTEMPTS) {
        await this.prisma.otpCode.update({
          where: { id: otp.id },
          data: { consumed: true },
        });
      }
      await this.recordAuthEvent({ action: 'OTP_LOGIN_FAILED', success: false, metadata: { phone, reason: 'invalid_code' } });
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumed: true },
    });

    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone },
      include: { business: true },
    });

    const accessToken = this.signToken({
      sub: user.id,
      phone: user.phone,
      email: user.email,
      businessId: user.businessId,
    });

    await this.recordAuthEvent({ action: 'OTP_LOGIN_SUCCEEDED', userId: user.id, businessId: user.businessId });

    return {
      accessToken,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        businessId: user.businessId,
      },
      hasBusiness: !!user.businessId,
    };
  }

  async demoLogin(phoneInput: string) {
    if (!this.demoAuthEnabled) {
      throw new BadRequestException('Demo login is not enabled');
    }

    const phone = this.normalizePhone(phoneInput);
    const demo = DEMO_BUSINESSES[phone];
    if (!demo) {
      await this.recordAuthEvent({ action: 'DEMO_LOGIN_FAILED', success: false, metadata: { phone } });
      throw new BadRequestException('Unknown demo account');
    }

    const business = await this.prisma.business.upsert({
      where: { ownerPhone: phone },
      update: { name: demo.name, city: demo.city },
      create: {
        ownerPhone: phone,
        name: demo.name,
        city: demo.city,
        vatEnabled: true,
        vatNumber: '300000000000003',
      },
    });

    const user = await this.prisma.user.upsert({
      where: { phone },
      update: { businessId: business.id },
      create: { phone, businessId: business.id },
    });

    const accessToken = this.signToken({
      sub: user.id,
      phone: user.phone,
      email: user.email,
      businessId: business.id,
    });

    await this.recordAuthEvent({ action: 'DEMO_LOGIN_SUCCEEDED', userId: user.id, businessId: business.id });

    return {
      accessToken,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        businessId: business.id,
      },
      hasBusiness: true,
      business,
    };
  }

  async googleLogin(credential: string) {
    if (!this.googleClientId) {
      throw new BadRequestException('Google login is not configured');
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: this.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      await this.recordAuthEvent({ action: 'GOOGLE_LOGIN_FAILED', success: false, metadata: { reason: 'invalid_credential' } });
      throw new UnauthorizedException('Invalid Google credential');
    }

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      await this.recordAuthEvent({ action: 'GOOGLE_LOGIN_FAILED', success: false, metadata: { reason: 'email_not_verified' } });
      throw new UnauthorizedException('Google account email is not verified');
    }

    const email = this.normalizeEmail(payload.email);
    const existing =
      (await this.prisma.user.findUnique({ where: { googleSub: payload.sub } })) ??
      (await this.prisma.user.findUnique({ where: { email } }));

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            googleSub: payload.sub,
            email,
            emailVerified: true,
            name: payload.name ?? existing.name,
            avatarUrl: payload.picture,
          },
        })
      : await this.prisma.user.create({
          data: {
            googleSub: payload.sub,
            email,
            emailVerified: true,
            name: payload.name,
            avatarUrl: payload.picture,
          },
        });

    const accessToken = this.signToken({
      sub: user.id,
      phone: user.phone,
      email: user.email,
      businessId: user.businessId,
    });

    await this.recordAuthEvent({ action: 'GOOGLE_LOGIN_SUCCEEDED', userId: user.id, businessId: user.businessId });

    return {
      accessToken,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        businessId: user.businessId,
      },
      hasBusiness: !!user.businessId,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { business: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const userPayload = {
      id: user.id,
      phone: user.phone,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
      businessId: user.businessId,
    };

    return {
      ...userPayload,
      business: user.business,
      user: userPayload,
    };
  }

  async registerEmail(emailInput: string, password: string, name?: string) {
    const email = this.normalizeEmail(emailInput);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.emailVerified) {
        await this.recordAuthEvent({ action: 'EMAIL_REGISTER_FAILED', success: false, userId: existing.id, businessId: existing.businessId, metadata: { reason: 'already_verified' } });
        throw new BadRequestException('هذا البريد الإلكتروني مسجّل بالفعل');
      }
      await this.sendVerificationEmail(existing);
      await this.recordAuthEvent({ action: 'EMAIL_VERIFICATION_CODE_SENT', userId: existing.id, businessId: existing.businessId, metadata: { reason: 'resend_existing_unverified' } });
      return { sent: true, message: 'أُرسل رمز التحقق مجدداً إلى بريدك' };
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name: name ?? null },
    });

    await this.sendVerificationEmail(user);
    await this.recordAuthEvent({ action: 'EMAIL_REGISTERED', userId: user.id, businessId: user.businessId });
    return { sent: true, message: 'تم التسجيل! تحقق من بريدك الإلكتروني وأدخل رمز التفعيل' };
  }

  async loginEmail(emailInput: string, password: string) {
    const email = this.normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      await this.recordAuthEvent({ action: 'EMAIL_LOGIN_FAILED', success: false, metadata: { email, reason: 'invalid_credentials' } });
      throw new UnauthorizedException('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await this.recordAuthEvent({ action: 'EMAIL_LOGIN_FAILED', success: false, userId: user.id, businessId: user.businessId, metadata: { reason: 'invalid_credentials' } });
      throw new UnauthorizedException('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    if (!user.emailVerified) {
      await this.recordAuthEvent({ action: 'EMAIL_LOGIN_FAILED', success: false, userId: user.id, businessId: user.businessId, metadata: { reason: 'email_not_verified' } });
      throw new BadRequestException('يجب تأكيد بريدك الإلكتروني أولاً. تحقق من صندوق الوارد.');
    }

    const accessToken = this.signToken({
      sub: user.id,
      phone: user.phone,
      email: user.email,
      businessId: user.businessId,
    });

    await this.recordAuthEvent({ action: 'EMAIL_LOGIN_SUCCEEDED', userId: user.id, businessId: user.businessId });

    return {
      accessToken,
      user: { id: user.id, phone: user.phone, email: user.email, name: user.name, businessId: user.businessId },
      hasBusiness: !!user.businessId,
    };
  }

  async verifyEmailToken(input: { token?: string; email?: string; code?: string }) {
    if (input.email && input.code) {
      return this.verifyEmailCode(input.email, input.code);
    }

    if (!input.token) {
      throw new BadRequestException('أدخل البريد الإلكتروني ورمز التحقق');
    }

    const record = await this.prisma.emailVerification.findFirst({
      where: { token: input.token, consumed: false, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!record) {
      await this.recordAuthEvent({ action: 'EMAIL_VERIFY_FAILED', success: false, metadata: { reason: 'invalid_or_expired_token' } });
      throw new BadRequestException('رابط التحقق غير صالح أو منتهي الصلاحية');
    }

    await this.prisma.emailVerification.update({
      where: { id: record.id },
      data: { consumed: true },
    });

    const user = await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    });

    await this.recordAuthEvent({ action: 'EMAIL_VERIFIED', userId: user.id, businessId: user.businessId, metadata: { method: 'token' } });

    const accessToken = this.signToken({
      sub: user.id,
      phone: user.phone,
      email: user.email,
      businessId: user.businessId,
    });

    return {
      accessToken,
      user: { id: user.id, phone: user.phone, email: user.email, name: user.name, businessId: user.businessId },
      hasBusiness: !!user.businessId,
    };
  }

  private async verifyEmailCode(emailInput: string, code: string) {
    const email = this.normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      await this.recordAuthEvent({ action: 'EMAIL_VERIFY_FAILED', success: false, metadata: { email, reason: 'unknown_email' } });
      throw new BadRequestException('رمز التحقق غير صالح أو منتهي الصلاحية');
    }

    const record = await this.prisma.emailVerification.findFirst({
      where: {
        userId: user.id,
        consumed: false,
        expiresAt: { gt: new Date() },
        codeHash: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record?.codeHash) {
      await this.recordAuthEvent({ action: 'EMAIL_VERIFY_FAILED', success: false, userId: user.id, businessId: user.businessId, metadata: { reason: 'missing_or_expired_code' } });
      throw new BadRequestException('رمز التحقق غير صالح أو منتهي الصلاحية');
    }

    const valid = await bcrypt.compare(code, record.codeHash);
    if (!valid) {
      const updated = await this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      if (updated.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
        await this.prisma.emailVerification.update({
          where: { id: record.id },
          data: { consumed: true },
        });
      }
      await this.recordAuthEvent({ action: 'EMAIL_VERIFY_FAILED', success: false, userId: user.id, businessId: user.businessId, metadata: { reason: 'invalid_code' } });
      throw new BadRequestException('رمز التحقق غير صالح أو منتهي الصلاحية');
    }

    await this.prisma.emailVerification.update({
      where: { id: record.id },
      data: { consumed: true },
    });

    const verified = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    await this.recordAuthEvent({ action: 'EMAIL_VERIFIED', userId: verified.id, businessId: verified.businessId, metadata: { method: 'code' } });

    const accessToken = this.signToken({
      sub: verified.id,
      phone: verified.phone,
      email: verified.email,
      businessId: verified.businessId,
    });

    return {
      accessToken,
      user: { id: verified.id, phone: verified.phone, email: verified.email, name: verified.name, businessId: verified.businessId },
      hasBusiness: !!verified.businessId,
    };
  }

  async resendVerificationEmail(emailInput: string) {
    const email = this.normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal whether email exists
      await this.recordAuthEvent({ action: 'EMAIL_VERIFICATION_RESEND_REQUESTED', metadata: { email, found: false } });
      return { sent: true };
    }
    if (user.emailVerified) {
      await this.recordAuthEvent({ action: 'EMAIL_VERIFICATION_RESEND_FAILED', success: false, userId: user.id, businessId: user.businessId, metadata: { reason: 'already_verified' } });
      throw new BadRequestException('البريد الإلكتروني مُفعَّل بالفعل');
    }
    await this.sendVerificationEmail(user);
    await this.recordAuthEvent({ action: 'EMAIL_VERIFICATION_CODE_SENT', userId: user.id, businessId: user.businessId, metadata: { reason: 'manual_resend' } });
    return { sent: true };
  }

  private async sendVerificationEmail(user: { id: string; email: string | null; name: string | null }) {
    if (!user.email) return;

    // Invalidate old codes and links.
    await this.prisma.emailVerification.updateMany({
      where: { userId: user.id, consumed: false },
      data: { consumed: true },
    });

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 12);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MINUTES * 60 * 1000);

    await this.prisma.emailVerification.create({
      data: { userId: user.id, token, codeHash, expiresAt },
    });

    await this.emailService.sendVerificationEmail(user.email, code, user.name);
  }

  signToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      expiresIn: '30d',
      jwtid: randomUUID(),
    });
  }

  async logout(rawToken: string): Promise<void> {
    const payload = this.jwtService.decode(rawToken) as JwtPayload & { exp?: number };
    const jti = payload?.jti;
    if (!jti) return;
    const expiresAt = payload.exp
      ? new Date(payload.exp * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.tokenBlacklist.upsert({
      where: { jti },
      update: {},
      create: { jti, expiresAt },
    });
    await this.recordAuthEvent({ action: 'LOGOUT', userId: payload.sub, businessId: payload.businessId });
  }
}
