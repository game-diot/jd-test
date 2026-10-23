import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { Injectable, StreamableFile } from '@nestjs/common';
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
export class TransformInterceptor<T>
  implements NestInterceptor<T, Envelope<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Envelope<T>> {
    return next.handle().pipe(
      map((data: T) => {
        // 文件流（StreamableFile）直接透传，不包装、不序列化
        if (data instanceof StreamableFile) {
          return data as unknown as Envelope<T>;
        }
        return {
          code: 'OK',
          message: 'success',
          data: this.serialize(data),
        };
      }),
    );
  }

  /**
   * JSON 序列化前把 BigInt 转字符串，避免 JSON.stringify(BigInt) 抛 TypeError。
   * Prisma 的 size_bytes 等 BigInt 字段会走到这里。
   */
  private serialize(value: unknown): T {
    if (value === undefined || value === null) return value as T;
    return JSON.parse(
      JSON.stringify(value, (_key, val) =>
        typeof val === 'bigint' ? val.toString() : val,
      ),
    ) as T;
  }
}