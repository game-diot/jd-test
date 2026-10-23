# 部署说明

## 1. 环境准备

- Node.js ≥ 22（后端运行）；前端**构建需 Node 20**。
- PostgreSQL。
- 私有文件存储目录（本地磁盘或私有 Bucket）。

## 2. 环境变量

后端 `server/.env`（见 `server/.env.example`）：

```bash
DATABASE_URL=postgresql://postgres:xxx@127.0.0.1:5432/contract_seal?schema=public
PORT=7001
JWT_SECRET=<强随机值>          # 生产必须改
FILE_STORAGE_DIR=./storage/files
DOWNLOAD_URL_TTL_SECONDS=300
```

## 3. 部署流程

```bash
# 后端
cd server
npm ci
npm run prisma:generate
npm run prisma:deploy     # 生产迁移（非 dev）
npm run prisma:seed        # 初始化账号/角色（生产按需移除测试账号）
npm run build
npm run start:prod         # 后台可由 pm2/容器托管

# 前端
nvm use 20
npm ci
npm run build              # 产物 dist/
```

前端构建产物 `dist/` 推荐由 Nginx 同域 serve，并将 `/api/` 反向代理到后端 7001；或由 NestJS 直接 serve 静态目录（同域部署，规避 CORS）。

## 4. 反向代理（Nginx 示例）

```nginx
server {
  listen 443 ssl;
  server_name your-domain.com;
  root /path/to/dist;

  location /api/ {
    proxy_pass http://127.0.0.1:7001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## 5. 冒烟测试

1. 访问首页 → 登录 → 进入合同申请页。
2. 创建申请 + 上传 PDF → 提交 → 审批人同意/驳回。
3. 管理员台账筛选 + 导出 Excel + 下载。
4. `GET /api/v1/health` 返回 `OK`。

## 6. 安全清单（生产上线前）

- [ ] 更换 `JWT_SECRET`。
- [ ] 移除/禁用 `prisma:seed` 测试账号，接入企业统一身份。
- [ ] 文件存储改用私有 Bucket 或受控目录。
- [ ] Nginx 配置 HTTPS + 安全响应头。
- [ ] CORS 白名单收紧（当前 `origin: true` 仅供本地联调）。
- [ ] 登录限流参数按业务调整（当前 100 次/分钟全局）。
- [ ] 审计日志保留策略 + 导出文件过期清理（`EXPIRED` + 孤儿附件清理已内置）。