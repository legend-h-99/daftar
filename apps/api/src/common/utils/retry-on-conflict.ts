import { Prisma } from '@prisma/client';

/**
 * Retries `fn` up to `maxRetries` times when it throws a Prisma P2002
 * unique-constraint violation. All other errors are re-thrown immediately.
 *
 * Used for sequential per-business numbering (invoices, purchases) where a
 * Serializable transaction is the primary guard and this retry loop is the
 * defense-in-depth safety net.
 */
export async function retryOnConflict<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
    }
  }
  throw lastError;
}
