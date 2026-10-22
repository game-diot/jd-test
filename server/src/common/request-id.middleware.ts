import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * 为每个请求注入 requestId（可追踪，PRD §11.1 / §12.3）。
 * 优先透传上游 `x-request-id`，否则生成 UUID。
 * 同时回写响应头 `x-request-id`。
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction) {
    const incoming = req.headers['x-request-id'];
    const id = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();
    req.id = id;
    res.setHeader('x-request-id', id);
    next();
  }
}