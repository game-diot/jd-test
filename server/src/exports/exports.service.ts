import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ExportJob, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';
import { FilesService } from '../files/files.service.js';
import { LedgerQueryDto } from '../ledger/dto/ledger-query.dto.js';
import { maskBankAccount, maskCreditCode } from '../utils/mask.js';

const TYPE_MAP: Record<string, string> = {
  PURCHASE: '采购合同',
  SALES: '销售合同',
  SERVICE: '服务合同',
  NDA: '保密协议',
};
const SEAL_MAP: Record<string, string> = {
  OFFICIAL_SEAL: '公章',
  CONTRACT_SEAL: '合同章',
  LEGAL_REP_SEAL: '法人章',
};
const STATUS_MAP: Record<string, string> = {
  DRAFT: '草稿',
  PENDING_APPROVAL: '待审批',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  WITHDRAWN: '已撤回',
  TERMINATED: '已终止',
};

const BATCH_SIZE = 1000;

@Injectable()
export class ExportsService implements OnModuleInit, OnModuleDestroy {
  private interval: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private prisma: PrismaService,
    private files: FilesService,
  ) {}

  onModuleInit() {
    // 内置 Worker：每 2s 轮询一个 QUEUED 任务执行（互斥防并发）
    this.interval = setInterval(() => {
      this.runPendingJobs().catch(() => {});
    }, 2000);
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  async createJob(userId: string, dto: LedgerQueryDto) {
    const filters = {
      contractNo: dto.contractNo,
      applicantId: dto.applicantId,
      contractType: dto.contractType,
      status: dto.status,
      minAmount: dto.minAmount,
      maxAmount: dto.maxAmount,
      startTime: dto.startTime,
      endTime: dto.endTime,
    };
    const job = await this.prisma.exportJob.create({
      data: {
        requested_by: userId,
        filters_snapshot: filters as never,
        status: 'QUEUED',
        expires_at: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actor_id: userId,
        action: 'EXPORT_REQUEST',
        resource_type: 'CONTRACT',
        resource_id: job.id,
        before_snapshot: filters,
        after_snapshot: { status: 'QUEUED' },
      },
    });
    return { id: job.id, status: job.status };
  }

  async listJobs(userId: string) {
    return this.prisma.exportJob.findMany({
      where: { requested_by: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async getJob(jobId: string, userId: string) {
    const job = await this.prisma.exportJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '导出任务不存在' });
    }
    if (job.requested_by !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权查看该任务' });
    }
    return job;
  }

  async getDownloadUrl(jobId: string, userId: string) {
    const job = await this.prisma.exportJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '导出任务不存在' });
    }
    if (job.requested_by !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权下载该导出结果' });
    }
    if (job.status !== 'SUCCEEDED' || !job.file_id) {
      throw new ForbiddenException({ code: 'NOT_READY', message: '导出尚未完成' });
    }
    if (job.expires_at && job.expires_at < new Date()) {
      await this.prisma.exportJob.update({
        where: { id: jobId },
        data: { status: 'EXPIRED' },
      });
      throw new ForbiddenException({ code: 'EXPORT_EXPIRED', message: '导出结果已过期' });
    }
    const url = await this.files.getDownloadUrl(job.file_id, userId);
    await this.prisma.auditLog.create({
      data: {
        actor_id: userId,
        action: 'EXPORT_DOWNLOAD',
        resource_type: 'CONTRACT',
        resource_id: jobId,
        before_snapshot: { row_count: job.row_count },
        after_snapshot: {},
      },
    });
    return url;
  }

  async runPendingJobs() {
    if (this.running) return;
    const job = await this.prisma.exportJob.findFirst({
      where: { status: 'QUEUED' },
      orderBy: { created_at: 'asc' },
    });
    if (!job) return;
    this.running = true;
    try {
      await this.runOne(job);
    } finally {
      this.running = false;
    }
  }

  /** OOM 防御：keyset 游标分批读 + exceljs 流式写，绝不 select * 拼大数组 */
  private async runOne(job: ExportJob) {
    const start = Date.now();
    const filters = job.filters_snapshot as unknown as Record<string, any>;
    await this.prisma.exportJob.update({
      where: { id: job.id },
      data: { status: 'RUNNING', started_at: new Date() },
    });

    try {
      const where = this.buildWhere(filters);
      const total = await this.prisma.contract.count({ where });
      const dir = path.resolve(process.env.FILE_STORAGE_DIR || './storage/files');
      const tmpDir = path.resolve(dir, 'tmp');
      await fs.mkdir(tmpDir, { recursive: true });
      const tmpPath = path.join(tmpDir, `${job.id}.xlsx`);

      const stream = createWriteStream(tmpPath);
      const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream });
      const sheet = wb.addWorksheet('合同台账');
      sheet.columns = [
        '申请编号',
        '申请人',
        '申请原因',
        '合同状态',
        '合同名称',
        '合同类型',
        '金额',
        '签约相对方',
        '统一社会信用代码',
        '银行账号',
        '用印类型',
        '申请时间',
      ].map((header) => ({ header, width: 22 }));

      let lastId: string | undefined;
      let written = 0;
      for (;;) {
        const rows = await this.prisma.contract.findMany({
          where: { ...where, ...(lastId ? { id: { gt: lastId } } : {}) },
          include: { items: true },
          orderBy: { id: 'asc' },
          take: BATCH_SIZE,
        });
        if (rows.length === 0) break;
        for (const c of rows) {
          for (const it of c.items) {
            sheet
              .addRow([
                c.application_no,
                c.applicant_name_snapshot,
                c.reason,
                STATUS_MAP[c.status] ?? c.status,
                it.contract_name,
                TYPE_MAP[it.contract_type] ?? it.contract_type,
                Number(it.amount),
                it.counterparty,
                maskCreditCode(it.credit_code),
                maskBankAccount(it.bank_account),
                SEAL_MAP[it.seal_type] ?? it.seal_type,
                c.created_at,
              ])
              .commit();
            written += 1;
          }
        }
        lastId = rows[rows.length - 1].id;
      }
      sheet.commit();
      await wb.commit();

      const buf = await fs.readFile(tmpPath);
      await fs.unlink(tmpPath);
      const storageKey = `exports/${randomUUID()}.xlsx`;
      await fs.mkdir(path.join(dir, 'exports'), { recursive: true });
      await fs.writeFile(path.join(dir, storageKey), buf);
      const checksum = createHash('sha256').update(buf).digest('hex');

      const fileRec = await this.prisma.file.create({
        data: {
          storage_key: storageKey,
          original_name: `合同台账_${new Date().toISOString().slice(0, 10)}.xlsx`,
          mime_type:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size_bytes: buf.length,
          checksum,
          uploaded_by: job.requested_by,
        },
      });

      const duration = Date.now() - start;
      await this.prisma.exportJob.update({
        where: { id: job.id },
        data: {
          status: 'SUCCEEDED',
          row_count: written,
          file_id: fileRec.id,
          completed_at: new Date(),
          duration_ms: duration,
        },
      });
      await this.prisma.auditLog.create({
        data: {
          actor_id: job.requested_by,
          action: 'EXPORT_REQUEST',
          resource_type: 'CONTRACT',
          resource_id: job.id,
          before_snapshot: filters,
          after_snapshot: { status: 'SUCCEEDED', row_count: written, duration_ms: duration, total },
        },
      });
    } catch (e) {
      await this.prisma.exportJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          error_message: String((e as Error).message),
          completed_at: new Date(),
          duration_ms: Date.now() - start,
        },
      });
      await this.prisma.auditLog.create({
        data: {
          actor_id: job.requested_by,
          action: 'EXPORT_REQUEST',
          resource_type: 'CONTRACT',
          resource_id: job.id,
          before_snapshot: filters,
          after_snapshot: { status: 'FAILED', error: String((e as Error).message) },
        },
      });
    }
  }

  private buildWhere(f: Record<string, any>): Prisma.ContractWhereInput {
    const where: Prisma.ContractWhereInput = {};
    if (f.contractNo) where.application_no = { contains: f.contractNo };
    if (f.applicantId) where.applicant_id = f.applicantId;
    if (f.contractType) where.items = { some: { contract_type: f.contractType } };
    if (f.status) where.status = f.status;
    if (f.minAmount || f.maxAmount) {
      where.total_amount = {
        ...(f.minAmount ? { gte: f.minAmount } : {}),
        ...(f.maxAmount ? { lte: f.maxAmount } : {}),
      };
    }
    if (f.startTime || f.endTime) {
      where.created_at = {
        ...(f.startTime ? { gte: new Date(f.startTime) } : {}),
        ...(f.endTime ? { lte: new Date(f.endTime) } : {}),
      };
    }
    return where;
  }
}