import { randomInt, randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common/types/auth.types';

const OTP_TTL_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.devOtpEnabled = configService.get<string>('AUTH_DEV_OTP') === 'true';
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
      businessId: user.businessId,
    });

    return {
      accessToken,
      user: { id: user.id, phone: user.phone, name: user.name, businessId: user.businessId },
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

    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      businessId: user.businessId,
      business: user.business,
    };
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
  }
}
