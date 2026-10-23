import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ContractType, SealType, Urgency } from '@prisma/client';
import { ApprovalRulesService } from '../approval/approval-rules.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateContractDto,
  ContractItemDto,
} from './dto/create-contract.dto.js';

/** 规范化十进制字符串校验：>0、最多两位小数（NDA 允许 "0" / "0.00"） */
function parseAmount(s: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Number(s);
}

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private approvalRules: ApprovalRulesService,
  ) {}

  async create(userId: string, dto: CreateContractDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { department: true },
    });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: '用户不存在' });
    }

    const total = this.validateAndSum(dto.items);
    const contract = await this.prisma.contract.create({
      data: {
        application_no: this.genApplicationNo(),
        applicant_id: userId,
        applicant_name_snapshot: user.name,
        department_id: user.department_id!,
        department_name_snapshot: user.department?.name ?? '',
        reason: dto.reason.trim(),
        urgency: dto.urgency as Urgency,
        total_amount: total,
        status: 'DRAFT',
        items: { create: this.toItemData(dto.items) },
      },
      include: { items: true },
    });
    return contract;
  }

  async findMine(userId: string) {
    return this.prisma.contract.findMany({
      where: { applicant_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { items: { include: { file: true } } },
    });
    if (!contract) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '申请单不存在' });
    }
    if (contract.applicant_id !== userId) {
      const roles = await this.getRoleCodes(userId);
      if (!roles.includes('admin')) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权查看该申请单' });
      }
    }
    return contract;
  }

  async update(id: string, userId: string, dto: CreateContractDto) {
    const existing = await this.prisma.contract.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '申请单不存在' });
    }
    if (existing.applicant_id !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权修改该申请单' });
    }
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException({
        code: 'NOT_DRAFT',
        message: '仅草稿状态可修改',
      });
    }

    const total = this.validateAndSum(dto.items);
    await this.prisma.contractItem.deleteMany({ where: { contract_id: id } });
    return this.prisma.contract.update({
      where: { id },
      data: {
        reason: dto.reason.trim(),
        urgency: dto.urgency as Urgency,
        total_amount: total,
        items: { create: this.toItemData(dto.items) },
      },
      include: { items: true },
    });
  }

  /** 提交：乐观锁 + 事务内生成审批链快照 + 首个待批任务 + 审计 */
  async submit(id: string, userId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { items: { include: { file: true } } },
    });
    if (!contract) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '申请单不存在' });
    }
    if (contract.applicant_id !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权提交该申请单' });
    }
    if (contract.status !== 'DRAFT') {
      throw new BadRequestException({ code: 'NOT_DRAFT', message: '仅草稿状态可提交' });
    }
    for (const item of contract.items) {
      if (!item.file_id) {
        throw new BadRequestException({
          code: 'FILE_REQUIRED',
          message: `合同「${item.contract_name}」缺少附件`,
        });
      }
    }

    // 金额后端重算（忽略客户端）
    const total = contract.items.reduce(
      (sum, it) => sum + Number(it.amount),
      0,
    );

    return this.prisma.$transaction(async (tx) => {
      // 乐观锁：DRAFT → PENDING，影响行数为 0 = 已被并发提交
      const lock = await tx.contract.updateMany({
        where: { id, status: 'DRAFT' },
        data: { status: 'PENDING_APPROVAL', submitted_at: new Date() },
      });
      if (lock.count === 0) {
        throw new ConflictException({
          code: 'ALREADY_SUBMITTED',
          message: '申请已提交，请勿重复操作',
        });
      }

      const route = this.approvalRules.computeRoute(total);
      const instance = await tx.approvalInstance.create({
        data: {
          business_type: 'CONTRACT',
          business_id: id,
          rule_version: 'v1',
          total_amount_snapshot: total.toFixed(2),
          status: 'PENDING_APPROVAL',
        },
      });

      for (let i = 0; i < route.length; i += 1) {
        const nodeType = route[i];
        const approver = await this.approvalRules.resolveApprover(
          nodeType,
          contract.department_id,
          tx,
        );
        if (!approver) {
          throw new ConflictException({
            code: 'APPROVER_NOT_FOUND',
            message: `审批人缺失：${nodeType}`,
          });
        }
        const node = await tx.approvalNode.create({
          data: {
            instance_id: instance.id,
            sequence: i + 1,
            node_type: nodeType,
            approver_id: approver.id,
            approver_name_snapshot: approver.name,
            department_id_snapshot: approver.department_id,
            status: 'PENDING',
            activated_at: i === 0 ? new Date() : null,
          },
        });
        if (i === 0) {
          await tx.approvalTask.create({
            data: {
              instance_id: instance.id,
              node_id: node.id,
              assignee_id: approver.id,
              task_type: 'APPROVAL',
              status: 'PENDING',
            },
          });
        }
      }

      await tx.contract.update({
        where: { id },
        data: { approval_instance_id: instance.id },
      });

      await tx.auditLog.create({
        data: {
          actor_id: userId,
          action: 'SUBMIT',
          resource_type: 'CONTRACT',
          resource_id: id,
          before_snapshot: { status: 'DRAFT' },
          after_snapshot: {
            status: 'PENDING_APPROVAL',
            total: total.toFixed(2),
            application_no: contract.application_no,
          },
        },
      });

      return {
        id,
        application_no: contract.application_no,
        total: total.toFixed(2),
        status: 'PENDING_APPROVAL',
      };
    });
  }

  /** 业务规则二次校验 + 金额合计（后端为准，忽略客户端合计） */
  private validateAndSum(items: ContractItemDto[]): string {
    let sum = 0;
    for (const it of items) {
      if (it.contractType === 'NDA') {
        if (it.sealType !== 'OFFICIAL_SEAL') {
          throw new BadRequestException({
            code: 'NDA_SEAL_RESTRICTED',
            message: '保密协议只能使用公章',
          });
        }
        const v = parseAmount(it.amount);
        if (Number.isNaN(v) || v !== 0) {
          throw new BadRequestException({
            code: 'NDA_AMOUNT_MUST_BE_ZERO',
            message: '保密协议金额必须为 0',
          });
        }
        continue;
      }
      const v = parseAmount(it.amount);
      if (Number.isNaN(v) || v <= 0) {
        throw new BadRequestException({
          code: 'INVALID_AMOUNT',
          message: '合同金额必须大于 0 且最多两位小数',
        });
      }
      sum += v;
    }
    return sum.toFixed(2);
  }

  private toItemData(items: ContractItemDto[]) {
    return items.map((it) => ({
      contract_name: it.contractName.trim(),
      contract_type: it.contractType as ContractType,
      amount: it.amount,
      counterparty: it.counterparty.trim(),
      seal_type: it.sealType as SealType,
      file_id: it.fileId ?? null,
    }));
  }

  private genApplicationNo(): string {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    const rand = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `CT${ymd}${rand}`;
  }

  private async getRoleCodes(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { user_id: userId },
      select: { role: { select: { code: true } } },
    });
    return rows.map((r) => r.role.code);
  }
}