import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Translates all Prisma error types into clean HTTP responses instead of
 * leaking raw database error messages, connection strings, or schema info
 * to API consumers.
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientRustPanicError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientUnknownRequestError
      | Prisma.PrismaClientInitializationError
      | Prisma.PrismaClientValidationError
      | Prisma.PrismaClientRustPanicError,
    host: ArgumentsHost,
  ) {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      let mapped: NotFoundException | ConflictException;
      switch (exception.code) {
        case 'P2025':
          mapped = new NotFoundException('Resource not found');
          break;
        case 'P2002':
          mapped = new ConflictException('A record with this value already exists');
          break;
        default:
          mapped = new ConflictException('Database request failed');
          break;
      }
      response.status(mapped.getStatus()).json(mapped.getResponse());
      return;
    }

    // All other Prisma errors (validation, init, unknown, panic) are internal —
    // return a generic 500 so connection strings and schema names never reach clients.
    const err = new InternalServerErrorException('An unexpected error occurred');
    response.status(err.getStatus()).json(err.getResponse());
  }
}
