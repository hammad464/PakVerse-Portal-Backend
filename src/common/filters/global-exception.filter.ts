import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as any;
        message = resp.message || message;
        if (Array.isArray(resp.message)) {
          errors = resp.message;
          message = 'Validation failed';
        }
      } else {
        message = String(exceptionResponse);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.CONFLICT;
      switch (exception.code) {
        case 'P2002':
          message = 'A record with this value already exists';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          message = 'Foreign key constraint violation';
          break;
        default:
          message = 'Database error occurred';
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled Error: ${exception.message}`, exception.stack);
    }

    const isDev = process.env.NODE_ENV !== 'production';

    this.logger.error(`[${status}] ${request.method} ${request.url} — ${message}`);

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      ...(errors && { errors }),
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(isDev && exception instanceof Error && { stack: exception.stack }),
    });
  }
}
