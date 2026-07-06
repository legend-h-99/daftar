import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Translates common Prisma error codes into clean HTTP responses instead of
 * leaking raw database error messages to API consumers.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
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

    const response = host.switchToHttp().getResponse();
    const status = mapped.getStatus();
    const body = mapped.getResponse();
    response.status(status).json(body);
  }
}
