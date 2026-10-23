import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // NestJS 依赖装饰器元数据（emitDecoratorMetadata）做构造注入，
  // esbuild 不生成 design:paramtypes，必须用 swc 转译（否则 DI 失效、Reflector 变 undefined）
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true, legacyDecorator: true },
        target: 'es2022',
        keepClassNames: true,
      },
      module: { type: 'es6' },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 60000,
    // 同一 PostgreSQL 库做集成，串行避免相互干扰
    fileParallelism: false,
    include: ['test/**/*.spec.ts'],
  },
});