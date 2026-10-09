import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

const phone = '+966500000001';

function setup(settings: Record<string, string> = {}) {
  const prisma = {
    otpCode: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: 'otp-1' }),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    business: { upsert: jest.fn() },
    tokenBlacklist: { upsert: jest.fn() },
    emailVerification: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
  };
  const jwt = {
    sign: jest.fn().mockReturnValue('signed-token'),
    decode: jest.fn(),
  };
  const email = { sendVerificationEmail: jest.fn() };
  const config = { get: jest.fn((key: string) => settings[key]) };
  const service = new AuthService(prisma as any, jwt as any, email as any, config as any);
  return { service, prisma, jwt, email };
}

describe('authentication security boundaries', () => {
  it('never returns an OTP in the production response and invalidates the previous code', async () => {
    const { service, prisma } = setup({ NODE_ENV: 'production' });

    const result = await service.requestOtp('0500000001');

    expect(result).toEqual({ sent: true });
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith({
      where: { phone, consumed: false },
      data: { consumed: true },
    });
    expect(prisma.otpCode.create).toHaveBeenCalledWith({
      data: { phone, code: expect.stringMatching(/^\d{6}$/), expiresAt: expect.any(Date) },
    });
    expect(prisma.otpCode.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.otpCode.create.mock.invocationCallOrder[0],
    );
  });

  it('rejects a reused OTP without issuing a token or modifying a user', async () => {
    const { service, prisma, jwt } = setup();
    prisma.otpCode.findFirst.mockResolvedValue(null);

    await expect(service.verifyOtp('0500000001', '123456')).rejects.toThrow(BadRequestException);

    expect(prisma.otpCode.findFirst).toHaveBeenCalledWith({
      where: { phone, consumed: false, expiresAt: { gt: expect.any(Date) } },
      orderBy: { createdAt: 'desc' },
    });
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('consumes a code on the fifth failed attempt', async () => {
    const { service, prisma, jwt } = setup();
    prisma.otpCode.findFirst.mockResolvedValue({ id: 'otp-1', code: '123456' });
    prisma.otpCode.update.mockResolvedValueOnce({ attempts: 5 }).mockResolvedValueOnce({ consumed: true });

    await expect(service.verifyOtp(phone, '654321')).rejects.toThrow(BadRequestException);

    expect(prisma.otpCode.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'otp-1' },
      data: { attempts: { increment: 1 } },
    });
    expect(prisma.otpCode.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'otp-1' },
      data: { consumed: true },
    });
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('rejects demo login when the production feature flag is absent before writing data', async () => {
    const { service, prisma } = setup({ NODE_ENV: 'production' });

    await expect(service.demoLogin('0500000001')).rejects.toThrow(BadRequestException);

    expect(prisma.business.upsert).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('fails closed for Google login without a configured client audience', async () => {
    const { service, prisma } = setup({ NODE_ENV: 'production' });

    await expect(service.googleLogin('untrusted-id-token')).rejects.toThrow(BadRequestException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown email', null],
    ['account without a password', { id: 'user-1', passwordHash: null }],
  ])('rejects %s with the same message', async (_case, user) => {
    const { service, prisma, jwt } = setup();
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(service.loginEmail('audit@example.invalid', 'bad-password')).rejects.toThrow(
      new UnauthorizedException('البريد الإلكتروني أو كلمة المرور غير صحيحة'),
    );

    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('rejects an incorrect password without issuing a token', async () => {
    const { service, prisma, jwt } = setup();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      passwordHash: await bcrypt.hash('correct-password', 4),
      emailVerified: true,
    });

    await expect(service.loginEmail('audit@example.invalid', 'wrong-password')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('requires email verification even when the password is correct', async () => {
    const { service, prisma, jwt } = setup();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      passwordHash: await bcrypt.hash('correct-password', 4),
      emailVerified: false,
    });

    await expect(service.loginEmail('audit@example.invalid', 'correct-password')).rejects.toThrow(
      BadRequestException,
    );

    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('issues a token for a verified account with a correct password', async () => {
    const { service, prisma, jwt } = setup();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'audit@example.invalid',
      phone: null,
      name: 'Auditor',
      businessId: 'business-1',
      passwordHash: await bcrypt.hash('correct-password', 4),
      emailVerified: true,
    });

    const result = await service.loginEmail('audit@example.invalid', 'correct-password');

    expect(result.accessToken).toBe('signed-token');
    expect(result.hasBusiness).toBe(true);
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1', businessId: 'business-1' }),
      expect.objectContaining({ expiresIn: '30d', jwtid: expect.any(String) }),
    );
  });

  it('rejects registration for an already verified address without changing credentials', async () => {
    const { service, prisma, email } = setup();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', emailVerified: true });

    await expect(service.registerEmail('audit@example.invalid', 'new-password')).rejects.toThrow(
      BadRequestException,
    );

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(email.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('rejects an expired or consumed email verification link without issuing a token', async () => {
    const { service, prisma, jwt } = setup();
    prisma.emailVerification.findFirst.mockResolvedValue(null);

    await expect(service.verifyEmailToken('invalid-token')).rejects.toThrow(BadRequestException);

    expect(prisma.emailVerification.findFirst).toHaveBeenCalledWith({
      where: { token: 'invalid-token', consumed: false, expiresAt: { gt: expect.any(Date) } },
      include: { user: true },
    });
    expect(prisma.emailVerification.update).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('consumes a valid email verification link before enabling the account', async () => {
    const { service, prisma } = setup();
    prisma.emailVerification.findFirst.mockResolvedValue({ id: 'verification-1', userId: 'user-1' });
    prisma.emailVerification.update.mockResolvedValue({ consumed: true });
    prisma.user.update.mockResolvedValue({
      id: 'user-1', email: 'audit@example.invalid', phone: null, name: null, businessId: null,
    });

    const result = await service.verifyEmailToken('valid-token');

    expect(result.accessToken).toBe('signed-token');
    expect(prisma.emailVerification.update).toHaveBeenCalledWith({
      where: { id: 'verification-1' }, data: { consumed: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' }, data: { emailVerified: true },
    });
    expect(prisma.emailVerification.update.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.user.update.mock.invocationCallOrder[0],
    );
  });

  it('writes a token revocation record using the JWT identifier and expiry', async () => {
    const { service, prisma, jwt } = setup();
    const expiresAtSeconds = Math.floor(Date.now() / 1000) + 3600;
    jwt.decode.mockReturnValue({ jti: 'token-id', exp: expiresAtSeconds });

    await service.logout('signed-token');

    expect(jwt.decode).toHaveBeenCalledWith('signed-token');
    expect(prisma.tokenBlacklist.upsert).toHaveBeenCalledWith({
      where: { jti: 'token-id' },
      update: {},
      create: { jti: 'token-id', expiresAt: new Date(expiresAtSeconds * 1000) },
    });
  });

  it('does not create a revocation record for a token without an identifier', async () => {
    const { service, prisma, jwt } = setup();
    jwt.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

    await service.logout('legacy-token');

    expect(prisma.tokenBlacklist.upsert).not.toHaveBeenCalled();
  });
});
