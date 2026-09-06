import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUserData, JwtPayload } from '../../common/types/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not set — refusing to start.');
    }
    super({
      // Try HttpOnly cookie first (web), fall back to Bearer header (mobile/API clients).
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies as Record<string, string>)?.access_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserData> {
    if (payload.jti) {
      const revoked = await this.prisma.tokenBlacklist.findUnique({
        where: { jti: payload.jti },
      });
      if (revoked) throw new UnauthorizedException('Token has been revoked');
    }
    return {
      userId: payload.sub,
      phone: payload.phone,
      email: payload.email,
      businessId: payload.businessId,
    };
  }
}
