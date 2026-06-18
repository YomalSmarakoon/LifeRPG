import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ValidationError {
  field: string;
  message: string;
}

interface NestValidationError {
  property: string;
  constraints?: Record<string, string>;
  children?: NestValidationError[];
}

function flattenValidationErrors(errors: NestValidationError[]): ValidationError[] {
  const result: ValidationError[] = [];
  for (const err of errors) {
    if (err.constraints) {
      const messages = Object.values(err.constraints);
      result.push({ field: err.property, message: messages.join('; ') });
    }
    if (err.children?.length) {
      result.push(...flattenValidationErrors(err.children));
    }
  }
  return result;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProd = process.env['NODE_ENV'] === 'production';

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: ValidationError[] | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;

        if (resp['message'] && typeof resp['message'] === 'string') {
          message = resp['message'];
        } else if (Array.isArray(resp['message'])) {
          message = 'Validation failed';
        }

        // class-validator errors come as an array of ValidationError objects
        if (Array.isArray(resp['message'])) {
          const rawErrors = resp['message'] as NestValidationError[];
          errors = flattenValidationErrors(rawErrors);
        }
      }
    } else {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );

      if (!isProd && exception instanceof Error) {
        message = exception.message;
      }
    }

    response.status(statusCode).json({
      statusCode,
      message,
      ...(errors && errors.length > 0 ? { errors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
