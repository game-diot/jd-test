import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Response } from 'express';

interface ErrorBody {
  code: string;
  message: string;
  details?: unknown[];
  requestId?: string | string[] | undefined;
}

/**
 * 统一错误响应：{ code, message, details?, requestId }
 * PRD §11.1：错误码稳定、不泄露敏感信息、每请求可追踪。
 */
@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const requestId = ctx.getRequest<Request & { id?: string }>()?.id;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = '服务器内部错误';
    let details: unknown[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        // 业务错误码由抛出处显式传入（如 code: 'WITHDRAW_NOT_ALLOWED'）
        code = (r.code as string) || httpCodeToBizCode(status);
        message = (r.message as string) || message;
        if (Array.isArray(r.details)) details = r.details;
        else if (Array.isArray((r as { message?: unknown }).message)) {
          details = (r as { message: unknown[] }).message;
        }
      }
      if (status === HttpStatus.BAD_REQUEST && code === 'INTERNAL_ERROR') {
        code = 'VALIDATION_ERROR';
      }
    }

    const body: ErrorBody = { code, message };
    if (details) body.details = details;
    if (requestId) body.requestId = requestId;

    response.status(status).json(body);
  }
}

function httpCodeToBizCode(status: number): string {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    default:
      return 'BAD_REQUEST';
  }
}