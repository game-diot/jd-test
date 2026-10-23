import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TerminateDto } from './dto/terminate.dto.js';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async allContracts() {
    return this.prisma.contract.findMany({
      include: { items: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async listAuditLogs(page = 1, pageSize = 20) {
    const take = Math.min(100, Math.max(1, pageSize));
    const skip = (Math.max(1, page) - 1) * take;
    const [total, data] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.findMany({
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
    ]);
    return { total, data };
  }

  async listExportJobs() {
    return this.prisma.exportJob.findMany({
      orderBy: { created_at: 'desc' },
      include: { requester: { select: { id: true, name: true } } },
    });
  }

  /** 强制终止：管理员 + 必填原因，仅在途（待审批）可终止 */
  async terminate(id: string, userId: string, dto: TerminateDto) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { approval_instance: true },
    });
    if (!contract) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '申请单不存在' });
    }
    if (contract.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException({ code: 'NOT_PENDING', message: '仅待审批状态可终止' });
    }
    const reason = dto.reason.trim();

    return this.prisma.$transaction(async (tx) => {
      const lock = await tx.contract.updateMany({
        where: { id, status: 'PENDING_APPROVAL' },
        data: { status: 'TERMINATED' },
      });
      if (lock.count === 0) {
        throw new ConflictException({ code: 'ALREADY_TERMINATED', message: '申请已终止或状态变更' });
      }
      if (contract.approval_instance_id) {
        await tx.approvalTask.updateMany({
          where: { instance_id: contract.approval_instance_id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        await tx.approvalInstance.update({
          where: { id: contract.approval_instance_id },
          data: { status: 'TERMINATED', completed_at: new Date() },
        });
        await tx.approvalAction.create({
          data: {
            instance_id: contract.approval_instance_id,
            actor_id: userId,
            action_type: 'TERMINATE',
            comment: reason,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actor_id: userId,
          action: 'TERMINATE',
          resource_type: 'CONTRACT',
          resource_id: id,
          before_snapshot: { status: 'PENDING_APPROVAL' },
          after_snapshot: { status: 'TERMINATED', reason },
        },
      });
      return { status: 'TERMINATED' };
    });
  }
}