# 企业级合同用印与审批平台

企业内部合同用印申请、逐级审批、台账查询与审计导出的统一 Web 管理平台。基于 Ant Design Pro v6 模板二次开发，前后端单仓。

## 技术栈

- **前端**：Ant Design Pro v6（React 19 + Ant Design 6 + ProComponents 3 + Umi Max 4 + TypeScript）
- **后端**：NestJS + TypeScript + Prisma，目录 `server/`
- **数据库**：PostgreSQL
- **文件存储**：私有目录 + 签名 URL 下载
- **测试**：Vitest + Supertest（后端 e2e）

## 核心功能

1. **合同用印申请**：动态明细、金额实时汇总、保密协议联动、审批链实时预览。
2. **审批中心**：待办/已办/我提交的/管理员全量；同意、驳回（≥10 字）、转交（同部门）、加签（同级/上级）、撤回、强制终止。
3. **合同台账与审计导出**：多条件组合查询 + URL Query 同步、敏感字段脱敏、附件二次鉴权、10 万条流式 Excel 导出（OOM 防御 + 审计）。

## 快速启动（5 分钟）

### 前置

- Node.js ≥ 22（前端 dev/build 需 **Node 20**：`nvm use 20`）
- PostgreSQL（本机已装，或 Docker）

### 1. 初始化数据库

```bash
createdb contract_seal   # 或 psql -c 'CREATE DATABASE contract_seal;'
```

### 2. 启动后端

```bash
cd server
cp .env.example .env     # 修改 DATABASE_URL 的密码为你的 PG 密码
npm install
npm run prisma:generate
npm run prisma:migrate   # 应用迁移（prisma migrate dev）
npm run prisma:seed      # 初始化 4 角色/4 部门/7 账号/2 审批岗位
npm run prisma:seed:history  # 预置 2000 条历史单据
npm run build
npm run start:prod       # 监听 http://127.0.0.1:7001/api/v1
```

### 3. 启动前端

```bash
nvm use 20
npm install
PORT=8001 npm run dev   # http://localhost:8001  （dev 走 proxy 连后端 7001）
```

浏览器打开 `http://localhost:8001`，用下方测试账号登录。

> 生产构建：`npm run build`（后端可同域 serve `dist/`，见 docs/architecture.md 部署说明）。

## 测试账号（统一密码 `Passw0rd!`）

| 角色 | 账号 | 权限 |
|---|---|---|
| 普通员工 | `zhangsan@corp.com` | 创建/撤回本人申请 |
| 部门主管(IT) | `lizhuguan@corp.com` | 主管节点审批 + 转交/加签 |
| 法务 | `zhaofawu@corp.com` | 法务节点审批 |
| 财务总监 | `qianzongjian@corp.com` | 财务总监节点审批 |
| 系统管理员 | `admin@corp.com` | 全量申请 + 强制终止 + 台账 + 导出 |
| 合规审计员 | `auditor@corp.com` | 台账查询 + 脱敏 + 导出 |

详见 [docs/test-accounts.md](docs/test-accounts.md)。

## 自动化测试

```bash
cd server
npm test                 # 12 个 e2e 用例：三级审批流/越权403/状态翻转/审计/脱敏
```

## 文档

- [架构设计说明](docs/architecture.md)
- [测试账号矩阵](docs/test-accounts.md)

## 审批链规则

| 金额 | 审批链 |
|---|---|
| < 50 万 | 部门主管 |
| 50 万 ~ 200 万 | 部门主管 → 法务 |
| ≥ 200 万 | 部门主管 → 法务 → 财务总监 |

审批链提交时后端重算并**固化快照**，后续组织/规则变更不影响在途单据。