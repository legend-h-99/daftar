import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let config: any;

  const futureDate = new Date(Date.now() + 10 * 60 * 1000);
  const pastDate = new Date(Date.now() - 10 * 60 * 1000);

  const mockOtp = {
    id: 'otp-1',
    code: '123456',
    expiresAt: futureDate,
    consumed: false,
    attempts: 0,
  };

  beforeEach(async () => {
    config = { get: jest.fn().mockReturnValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            otpCode: {
              updateMany: jest.fn().mockResolvedValue({ count: 0 }),
              create: jest.fn().mockResolvedValue(mockOtp),
              findFirst: jest.fn().mockResolvedValue(mockOtp),
              update: jest.fn().mockResolvedValue(mockOtp),
            },
            user: {
              upsert: jest.fn().mockResolvedValue({
                id: 'user-1',
                phone: '+966500000001',
                name: null,
                businessId: null,
              }),
            },
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock-jwt') },
        },
        {
          provide: ConfigService,
          useValue: config,
        },
        {
          provide: EmailService,
          useValue: { sendVerificationEmail: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    prisma = module.get(PrismaService);
  });

  it('requestOtp without AUTH_DEV_OTP returns { sent: true } only', async () => {
    const result = await service.requestOtp('0500000001');
    expect(result.sent).toBe(true);
    expect((result as any).devCode).toBeUndefined();
  });

  it('requestOtp with AUTH_DEV_OTP=true returns devCode', async () => {
    config.get = jest.fn().mockImplementation((key: string) => {
      if (key === 'AUTH_DEV_OTP') return 'true';
      if (key === 'NODE_ENV') return 'development';
      return undefined;
    });
    // Rebuild module with devOtp enabled
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            otpCode: {
              updateMany: jest.fn().mockResolvedValue({ count: 0 }),
              create: jest.fn().mockResolvedValue({ ...mockOtp, code: '654321' }),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            user: { upsert: jest.fn() },
          },
        },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: EmailService, useValue: { sendVerificationEmail: jest.fn() } },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    const svc = module.get(AuthService);
    const result = await svc.requestOtp('0500000001');
    expect(result.sent).toBe(true);
    expect((result as any).devCode).toBeDefined();
  });

  it('verifyOtp with correct code returns accessToken and user', async () => {
    const result = await service.verifyOtp('0500000001', '123456');
    expect(result.accessToken).toBe('mock-jwt');
    expect(result.user).toBeDefined();
  });

  it('verifyOtp with wrong code throws BadRequestException', async () => {
    // findFirst returns null → OTP not found or expired
    prisma.otpCode.findFirst = jest.fn().mockResolvedValue(null);
    await expect(service.verifyOtp('0500000001', 'wrong')).rejects.toThrow(BadRequestException);
  });

  it('verifyOtp with expired code throws BadRequestException', async () => {
    prisma.otpCode.findFirst = jest.fn().mockResolvedValue({
      ...mockOtp,
      expiresAt: pastDate,
    });
    // The service filters expiresAt: { gt: new Date() } in the DB query.
    // An expired OTP would not be returned by the real DB, so findFirst returns null here.
    // NOTE: the mock ignores the where clause, so we simulate by returning null.
    prisma.otpCode.findFirst = jest.fn().mockResolvedValue(null);
    await expect(service.verifyOtp('0500000001', '123456')).rejects.toThrow(BadRequestException);
  });

  it('verifyOtp after 5 failed attempts throws BadRequestException', async () => {
    // Simulate a valid OTP in DB (not yet consumed), but code submitted is wrong.
    // The update call returns attempts=5, which triggers BadRequestException.
    // NOTE: The "5 attempts" guard fires on code mismatch path (otp.code !== code),
    // not on a separate pre-check. We submit a wrong code so the mismatch branch runs.
    prisma.otpCode.update = jest.fn().mockResolvedValue({ ...mockOtp, attempts: 5 });
    await expect(service.verifyOtp('0500000001', 'wrong-code')).rejects.toThrow(BadRequestException);
  });

  // AUTH_DEV_OTP allowlist guard (plan 008)
  it('should throw if AUTH_DEV_OTP=true and NODE_ENV=production', async () => {
    const cfg = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'AUTH_DEV_OTP') return 'true';
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      }),
    };
    const mockPrisma = {
      otpCode: { updateMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      user: { upsert: jest.fn() },
    };
    const mockJwt = { sign: jest.fn() };
    const mockEmail = { sendVerificationEmail: jest.fn() };
    expect(() => new AuthService(mockPrisma as any, mockJwt as any, mockEmail as any, cfg as any)).toThrow(
      'AUTH_DEV_OTP is only allowed when NODE_ENV is "development" or "test"',
    );
  });

  it('should throw if AUTH_DEV_OTP=true and NODE_ENV=staging', async () => {
    const cfg = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'AUTH_DEV_OTP') return 'true';
        if (key === 'NODE_ENV') return 'staging';
        return undefined;
      }),
    };
    const mockPrisma = {
      otpCode: { updateMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      user: { upsert: jest.fn() },
    };
    const mockJwt = { sign: jest.fn() };
    const mockEmail = { sendVerificationEmail: jest.fn() };
    expect(() => new AuthService(mockPrisma as any, mockJwt as any, mockEmail as any, cfg as any)).toThrow(
      'AUTH_DEV_OTP is only allowed when NODE_ENV is "development" or "test"',
    );
  });

  it('should NOT throw if AUTH_DEV_OTP=true and NODE_ENV=development', async () => {
    const cfg = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'AUTH_DEV_OTP') return 'true';
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      }),
    };
    const mockPrisma = {
      otpCode: { updateMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      user: { upsert: jest.fn() },
    };
    const mockJwt = { sign: jest.fn() };
    const mockEmail = { sendVerificationEmail: jest.fn() };
    expect(() => new AuthService(mockPrisma as any, mockJwt as any, mockEmail as any, cfg as any)).not.toThrow();
  });
});
