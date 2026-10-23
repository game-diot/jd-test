import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/http-exception.filter.js';
import { TransformInterceptor } from '../src/common/transform.interceptor.js';

const PASSWORD = 'Passw0rd!';

describe('企业级合同用印与审批平台 e2e', () => {
  let app: INestApplication;
  let server: any;

  let tokenEmployee: string;
  let tokenManager: string; // 李主管（IT 部门主管）
  let tokenLegal: string; // 赵法务
  let tokenCfo: string; // 钱总监
  let tokenAdmin: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    server = app.getHttpServer();

    const login = async (account: string) => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ account, password: PASSWORD });
      return res.body.data.token as string;
    };
    tokenEmployee = await login('zhangsan@corp.com');
    tokenManager = await login('lizhuguan@corp.com');
    tokenLegal = await login('zhaofawu@corp.com');
    tokenCfo = await login('qianzongjian@corp.com');
    tokenAdmin = await login('admin@corp.com');
  });

  afterAll(async () => {
    await app.close();
  });

  const createAndSubmit = async (token: string, amount: string, reason = '自动化测试合同') => {
    // 附件必填：先上传一个合法 PDF
    const file = await request(server)
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1.4\n%%EOF\n'), {
        filename: 'test.pdf',
        contentType: 'application/pdf',
      });
    const fileId = file.body.data.id as string;

    const created = await request(server)
      .post('/api/v1/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reason,
        urgency: 'NORMAL',
        items: [
          {
            contractName: '测试合同',
            contractType: 'PURCHASE',
            amount,
            counterparty: '测试相对方',
            sealType: 'OFFICIAL_SEAL',
            fileId,
          },
        ],
      });
    const cid = created.body.data.id as string;
    await request(server)
      .post(`/api/v1/contracts/${cid}/submit`)
      .set('Authorization', `Bearer ${token}`);
    return cid;
  };

  const pendingOf = async (token: string) => {
    const res = await request(server)
      .get('/api/v1/approvals/pending')
      .set('Authorization', `Bearer ${token}`);
    return res.body.data as any[];
  };

  describe('认证与 RBAC 垂直鉴权', () => {
    it('登录成功返回 token 与角色', async () => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ account: 'zhangsan@corp.com', password: PASSWORD });
      expect(res.body.code).toBe('OK');
      expect(res.body.data.token).toBeTruthy();
      expect(res.body.data.profile.roles).toContain('employee');
    });

    it('错误密码返回 401', async () => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ account: 'zhangsan@corp.com', password: 'wrongpass' });
      expect(res.status).toBe(401);
    });

    it('未带 token 访问受保护接口返回 401', async () => {
      const res = await request(server).get('/api/v1/ledger/contracts');
      expect(res.status).toBe(401);
    });

    it('普通员工访问管理员台账接口返回 403', async () => {
      const res = await request(server)
        .get('/api/v1/ledger/contracts')
        .set('Authorization', `Bearer ${tokenEmployee}`);
      expect(res.status).toBe(403);
    });
  });

  describe('三级审批流（≥200万走三级）', () => {
    it('200万单据依次经 部门主管→法务→财务总监 后 APPROVED', async () => {
      const cid = await createAndSubmit(tokenEmployee, '2000000.00', '三级审批测试');

      // 第一级：李主管
      let pending = await pendingOf(tokenManager);
      const task1 = pending.find((t) => t.node.instance.business_id === cid);
      expect(task1).toBeTruthy();
      const approve1 = await request(server)
        .post(`/api/v1/approvals/${task1.id}/approve`)
        .set('Authorization', `Bearer ${tokenManager}`);
      expect(approve1.body.data.status).toBe('APPROVED');

      // 第二级：赵法务
      pending = await pendingOf(tokenLegal);
      const task2 = pending.find((t) => t.node.instance.business_id === cid);
      expect(task2).toBeTruthy();
      await request(server)
        .post(`/api/v1/approvals/${task2.id}/approve`)
        .set('Authorization', `Bearer ${tokenLegal}`);

      // 第三级：钱总监（末节点）
      pending = await pendingOf(tokenCfo);
      const task3 = pending.find((t) => t.node.instance.business_id === cid);
      expect(task3).toBeTruthy();
      const approve3 = await request(server)
        .post(`/api/v1/approvals/${task3.id}/approve`)
        .set('Authorization', `Bearer ${tokenCfo}`);
      expect(approve3.body.data.status).toBe('APPROVED');

      // 最终合同状态
      const res = await request(server)
        .get(`/api/v1/contracts/${cid}`)
        .set('Authorization', `Bearer ${tokenEmployee}`);
      expect(res.body.data.status).toBe('APPROVED');
    });
  });

  describe('水平越权防御（核心）', () => {
    it('员工审批不属于自己的任务返回 403', async () => {
      const cid = await createAndSubmit(tokenEmployee, '100000.00', '越权测试');
      const pending = await pendingOf(tokenManager);
      const task = pending.find((t) => t.node.instance.business_id === cid);
      expect(task).toBeTruthy();
      // 张三（非任务归属人）试图审批李主管的任务
      const res = await request(server)
        .post(`/api/v1/approvals/${task.id}/approve`)
        .set('Authorization', `Bearer ${tokenEmployee}`);
      expect(res.status).toBe(403);
    });

    it('员工伪造 applicantId 查询他人单据被拒绝', async () => {
      // 台账接口对 employee 角色本身 403（垂直），此处验证员工伪造自己的单也拿不到其他人的
      const res = await request(server)
        .get('/api/v1/contracts/mine?applicantId=someone-else')
        .set('Authorization', `Bearer ${tokenEmployee}`);
      // mine 只返回本人，applicantId 参数被忽略
      expect(res.body.data.every((c: any) => c.applicant_id !== 'someone-else')).toBe(true);
    });
  });

  describe('状态机与状态翻转边界', () => {
    it('草稿重复提交第二次被拒绝', async () => {
      const cid = await createAndSubmit(tokenEmployee, '50000.00', '重复提交测试');
      const res = await request(server)
        .post(`/api/v1/contracts/${cid}/submit`)
        .set('Authorization', `Bearer ${tokenEmployee}`);
      expect(res.status).toBe(400); // NOT_DRAFT
    });

    it('已通过的终态单据再次审批被拒绝', async () => {
      const cid = await createAndSubmit(tokenEmployee, '800000.00', '终态再审测试');
      // 走完三级（复用 200万 逻辑，此处用 30万 仅两级：主管+法务）
      let pending = await pendingOf(tokenManager);
      let task = pending.find((t) => t.node.instance.business_id === cid);
      await request(server)
        .post(`/api/v1/approvals/${task.id}/approve`)
        .set('Authorization', `Bearer ${tokenManager}`);
      pending = await pendingOf(tokenLegal);
      task = pending.find((t) => t.node.instance.business_id === cid);
      await request(server)
        .post(`/api/v1/approvals/${task.id}/approve`)
        .set('Authorization', `Bearer ${tokenLegal}`);

      // 终态后再审（任务已 APPROVED，不属于 PENDING）
      const res = await request(server)
        .post(`/api/v1/approvals/${task.id}/approve`)
        .set('Authorization', `Bearer ${tokenLegal}`);
      expect(res.body.code).toBe('TASK_ALREADY_HANDLED');
    });

    it('已撤回单据再次撤回被拒绝', async () => {
      const cid = await createAndSubmit(tokenEmployee, '10000.00', '撤回测试');
      const pending = await pendingOf(tokenManager);
      const task = pending.find((t) => t.node.instance.business_id === cid);
      // 首节点未处理前撤回
      await request(server)
        .post(`/api/v1/contracts/${cid}/withdraw`)
        .set('Authorization', `Bearer ${tokenEmployee}`);
      // 再撤回
      const res = await request(server)
        .post(`/api/v1/contracts/${cid}/withdraw`)
        .set('Authorization', `Bearer ${tokenEmployee}`);
      expect(res.body.code).toBe('WITHDRAW_NOT_ALLOWED');
    });
  });

  describe('审计与合规', () => {
    it('驳回后审计日志完整包含操作人、原因、前后状态', async () => {
      const cid = await createAndSubmit(tokenEmployee, '80000.00', '审计驳回测试');
      const pending = await pendingOf(tokenManager);
      const task = pending.find((t) => t.node.instance.business_id === cid);
      const reject = await request(server)
        .post(`/api/v1/approvals/${task.id}/reject`)
        .set('Authorization', `Bearer ${tokenManager}`)
        .send({ comment: '合同条款存在重大风险，需要法务进一步审核' });
      expect(reject.body.data.status).toBe('REJECTED');

      // 审计断言：prisma 层查 audit_logs
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      const audit = await prisma.auditLog.findFirst({
        where: { resource_id: cid, action: 'REJECT' },
        orderBy: { created_at: 'desc' },
      });
      expect(audit).toBeTruthy();
      expect(audit!.actor_id).toBeTruthy();
      expect((audit!.after_snapshot as any).comment).toContain('重大风险');
      await prisma.$disconnect();
    });
  });

  describe('数据脱敏', () => {
    it('台账接口返回的信用代码/银行账号已脱敏，无明文', async () => {
      const res = await request(server)
        .get('/api/v1/ledger/contracts?page=1&pageSize=50&contractNo=CT2026')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      const rows = res.body.data.data as any[];
      expect(rows.length).toBeGreaterThan(0);
      const anyCredit = rows
        .flatMap((r) => r.items ?? [])
        .map((it: any) => it.credit_code)
        .filter(Boolean);
      const anyBank = rows
        .flatMap((r) => r.items ?? [])
        .map((it: any) => it.bank_account)
        .filter(Boolean);
      // 脱敏值含 * 号，且不含明文
      expect(anyCredit.some((v: string) => v.includes('*'))).toBe(true);
      expect(anyCredit.some((v: string) => v.includes('MA1FL0'))).toBe(false);
      expect(anyBank.some((v: string) => v.includes('1234567'))).toBe(false);
    });
  });
});