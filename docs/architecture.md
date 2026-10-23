# 架构设计说明 · 企业级合同用印与审批平台

## 1. 总体架构

模块化单体（V1.0 不拆微服务），前后端分离部署、同域交付。

```
┌───────────────┐         ┌─────────────────────────────────┐
│  前端 SPA      │  HTTP   │  后端 NestJS (模块化单体)          │
│  Ant Design Pro │───────▶│  Controller → Guard → Service   │
│  React 19 + Umi │ /api/v1│          → Prisma → PostgreSQL   │
└───────────────┘         │  Worker（导出）· 私有文件存储      │
                          └─────────────────────────────────┘
```

- **前端**：Ant Design Pro v6（React 19 + antd 6 + ProComponents 3 + Umi Max 4），仅用模板已有依赖。
- **后端**：NestJS + TypeScript + Prisma + PostgreSQL，`/api/v1` 前缀。
- **文件存储**：私有本地目录 / 私有 Bucket，随机对象键，签名 URL 下载，不暴露物理路径。
- **异步导出**：数据库任务表（`export_jobs`）+ 进程内 Worker（无需 Redis/BullMQ）。

## 2. 后端模块（`server/src/`）

| 模块 | 职责 |
|---|---|
| `auth/` | JWT 登录/登出/me，`@Public`/`@Roles` 守卫，RBAC |
| `users/` | 用户查询（转交/加签可选人） |
| `contracts/` | 申请主表 + 明细 + 草稿 CRUD + 提交/撤回事务 |
| `files/` | PDF 上传（魔数校验）、元数据、签名 URL 下载、孤儿清理 |
| `approval/` | 审批规则引擎 + 完整状态机（同意/驳回/转交/加签） |
| `admin/` | 全量申请、强制终止、审计日志、导出任务管理 |
| `ledger/` | 台账组合查询 + 脱敏 + 详情 |
| `exports/` | 导出任务 + 流式 XLSX Worker |
| `common/` | 统一响应拦截器、异常过滤器、requestId 中间件 |
| `prisma/` | Prisma 连接服务 |

全局：`ThrottlerGuard`（限流）→ `JwtAuthGuard`（认证）→ `RolesGuard`（角色）。

## 3. 数据库（16 表，snake_case，UUID 主键，金额 DECIMAL(18,2)）

**核心关系**：`contracts`（申请）→ `contract_items`（明细）→ `files`（附件）；
`approval_instances`（审批实例快照）→ `approval_nodes`（节点快照）→ `approval_tasks`（任务）；
`approval_actions`（审批历史）、`approval_signatures`（加签）、`audit_logs`（审计）、`export_jobs`（导出任务）。

**关键设计**：
- 审批链是**提交时快照**（`approval_instances`/`approval_nodes` 固化审批人姓名/部门 ID），后续组织/规则变更不影响在途单据。
- 申请单状态（6 态）与审批任务状态（7 态）分表分字段，互不混淆。
- 并发控制：`contracts`/`approval_tasks` 乐观锁 `version` + `updateMany where status='...'` 影响行数校验。
- 高频字段建索引（`application_no` unique、`applicant_id`、`status`、`created_at`、`file_id`、`requested_by`）。

## 4. 关键业务规则

- **审批链路由**（后端 `approval-rules.service.ts` 裁决，不信前端）：<50 万→部门主管；50–200 万→主管+法务；≥200 万→主管+法务+财务总监。
- **审批人解析**：部门主管=`departments.manager_user_id`；法务/财务总监=`approval_positions` 映射；找不到 → 提交失败（`APPROVER_NOT_FOUND`），不跳过节点。
- **保密协议**：仅公章 + 金额=0（前后端双重校验）。
- **撤回**：仅待审批 + 首节点未处理。
- **转交**：同部门 + 审批资格；**加签**：同级或上级（`job_level≥`）；**驳回**：原因 ≥10 字；均事务 + 乐观锁 + 审计。

## 5. 安全设计

服务端二次校验（不信前端身份/参数）· 水平越权 403 · 附件私有存储 + 短时效签名 URL · 敏感字段统一脱敏（`utils/mask.ts`）· 登录限流（Throttler）· Helmet 安全头 · 孤儿附件清理 · 导出文件过期 · SQL 参数化 + 排序白名单 · 审计日志（操作人/前后快照/原因）。

## 6. 数据脱敏规则（服务端统一）

- 统一社会信用代码：`91310000MA1FL0ABCD` → `9131**********ABCD`
- 银行账号：`6222020200001234567` → `6222 **** **** 4567`
- 接口与导出 Excel 走同一套规则，非法格式不因脱敏失败而原样泄露。

## 7. 异步导出（OOM 防御）

`export_jobs` 表做任务持久化，进程内 Worker 每 2s 轮询一个 `QUEUED` 任务（互斥防并发）。执行时 **keyset 游标分批**（`take:1000`）读 DB + **exceljs 流式**写 XLSX，绝不分页拼大数组。导出完存私有 files 表 + 短时效签名下载 + 审计（操作人/筛选/条数/耗时/结果）+ `EXPIRED` 过期禁下载。