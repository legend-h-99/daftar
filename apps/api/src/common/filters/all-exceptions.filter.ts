import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

/**
 * Last-resort exception filter. Catches anything not handled by a more
 * specific filter and returns a safe 500 — ensuring that raw error messages,
 * stack traces, database connection strings, or schema names never leak to
 * API consumers, regardless of what threw.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    // Log internally so issues are debuggable, but never forward raw messages.
    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
    });
  }
}
