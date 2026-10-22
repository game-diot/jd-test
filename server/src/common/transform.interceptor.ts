import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';

export interface Envelope<T = unknown> {
  code: string;
  message: string;
  data: T;
}

/**
 * 统一成功响应：{ code: "OK", message: "success", data }
 * PRD §11.1。
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Envelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Envelope<T>> {
    return next.handle().pipe(
      map((data: T) => ({
        code: 'OK',
        message: 'success',
        data,
      })),
    );
  }
}