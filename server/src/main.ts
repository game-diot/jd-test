import 'dotenv/config';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { RequestIdMiddleware } from './common/request-id.middleware.js';
import { TransformInterceptor } from './common/transform.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // 全局前缀 /api/v1（PRD §11.1）
  app.setGlobalPrefix('api/v1');

  // requestId 中间件（每个请求可追踪）
  const requestIdMiddleware = app.get(RequestIdMiddleware);
  app.use(requestIdMiddleware.use.bind(requestIdMiddleware));

  // 全局异常过滤器：统一 { code, message, details, requestId }
  app.useGlobalFilters(new HttpExceptionFilter());

  // 全局响应拦截器：统一 { code: "OK", message: "success", data }
  app.useGlobalInterceptors(new TransformInterceptor());

  // 全局 DTO 校验（阶段 4 启用；whitelist 剔除未声明字段）
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // 安全响应头（helmet 默认策略）
  app.use(helmet());

  // CORS（同域部署时由 Nginx 兜底；本地联调放开同源即可）
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // OpenAPI 文档（评审要求 API 文档）
  const config = new DocumentBuilder()
    .setTitle('企业级合同用印与审批平台 API')
    .setDescription('合同用印申请、审批流转、台账与审计导出')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT || 7001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://127.0.0.1:${port}/api/v1`);
}
bootstrap();