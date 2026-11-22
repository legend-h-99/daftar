import { Prisma } from '@prisma/client';
import { retryOnConflict } from './retry-on-conflict';

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`Prisma error ${code}`, {
    code,
    clientVersion: 'test',
  });

const uniqueViolation = () => knownError('P2002');

describe('retryOnConflict', () => {
  it('returns the value and calls fn once when it succeeds immediately', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(retryOnConflict(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries after a P2002 unique-constraint violation and returns the eventual result', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(uniqueViolation())
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValueOnce(42);

    await expect(retryOnConflict(fn)).resolves.toBe(42);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('rethrows the last P2002 once maxRetries attempts are exhausted', async () => {
    const error = uniqueViolation();
    const fn = jest.fn().mockRejectedValue(error);

    await expect(retryOnConflict(fn, 3)).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('defaults to five attempts', async () => {
    const fn = jest.fn().mockRejectedValue(uniqueViolation());

    await expect(retryOnConflict(fn)).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('succeeds on the last allowed attempt', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(uniqueViolation())
      .mockRejectedValueOnce(uniqueViolation())
      .mockRejectedValueOnce(uniqueViolation())
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValueOnce('last');

    await expect(retryOnConflict(fn)).resolves.toBe('last');
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('does not retry when maxRetries is 1', async () => {
    const fn = jest.fn().mockRejectedValue(uniqueViolation());

    await expect(retryOnConflict(fn, 1)).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rethrows other Prisma known errors immediately without retrying', async () => {
    const error = knownError('P2025');
    const fn = jest.fn().mockRejectedValue(error);

    await expect(retryOnConflict(fn)).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rethrows plain errors immediately without retrying', async () => {
    const error = new Error('connection reset');
    const fn = jest.fn().mockRejectedValue(error);

    await expect(retryOnConflict(fn)).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('stops retrying as soon as a non-P2002 error appears mid-way', async () => {
    const error = new Error('deadlock');
    const fn = jest
      .fn()
      .mockRejectedValueOnce(uniqueViolation())
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('never reached');

    await expect(retryOnConflict(fn)).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
