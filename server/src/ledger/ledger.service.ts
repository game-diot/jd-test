import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { LedgerQueryDto } from './dto/ledger-query.dto.js';
import { maskBankAccount, maskCreditCode } from '../utils/mask.js';

// 排序字段白名单（防注入）
const SORTABLE = new Set([
  'created_at',
  'submitted_at',
  'total_amount',
  'application_no',
]);

@Injectable()
export class LedgerService {
  constructor(private prisma: PrismaService) {}

  async query(q: LedgerQueryDto) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));

    const where: Prisma.ContractWhereInput = {};
    if (q.contractNo) where.application_no = { contains: q.contractNo };
    if (q.applicantId) where.applicant_id = q.applicantId;
    if (q.contractType) where.items = { some: { contract_type: q.contractType as never } };
    if (q.status) where.status = q.status as never;
    if (q.minAmount || q.maxAmount) {
      where.total_amount = {
        ...(q.minAmount ? { gte: q.minAmount } : {}),
        ...(q.maxAmount ? { lte: q.maxAmount } : {}),
      };
    }
    if (q.startTime || q.endTime) {
      where.created_at = {
        ...(q.startTime ? { gte: new Date(q.startTime) } : {}),
        ...(q.endTime ? { lte: new Date(q.endTime) } : {}),
      };
    }

    const sortField = SORTABLE.has(q.sortField ?? '') ? q.sortField! : 'created_at';
    const sortOrder = q.sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, rows] = await Promise.all([
      this.prisma.contract.count({ where }),
      this.prisma.contract.findMany({
        where,
        include: { items: { include: { file: true } } },
        orderBy: { [sortField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // 服务端统一脱敏
    const data = rows.map((c) => ({
      ...c,
      total_amount: c.total_amount.toString(),
      items: c.items.map((it) => ({
        ...it,
        amount: it.amount.toString(),
        credit_code: maskCreditCode(it.credit_code),
        bank_account: maskBankAccount(it.bank_account),
      })),
    }));

    return { total, current: page, pageSize, data };
  }

  /** 台账详情（含明细 + 脱敏） */
  async detail(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { items: { include: { file: true } } },
    });
    if (!contract) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '申请单不存在' });
    }
    return {
      ...contract,
      total_amount: contract.total_amount.toString(),
      items: contract.items.map((it) => ({
        ...it,
        amount: it.amount.toString(),
        credit_code: maskCreditCode(it.credit_code),
        bank_account: maskBankAccount(it.bank_account),
      })),
    };
  }
}