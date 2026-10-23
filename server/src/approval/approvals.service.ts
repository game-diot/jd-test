import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AddSignDto,
  RejectDto,
  TransferDto,
} from './dto/approval.dto.js';

type Db = PrismaService | Prisma.TransactionClient;

const taskInclude = {
  node: {
    include: {
      instance: {
        include: { contract: { include: { items: true } } },
      },
    },
  },
};

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  // ---------- 列表 / 详情 ----------

  async pending(userId: string) {
    return this.prisma.approvalTask.findMany({
      where: { assignee_id: userId, status: { in: ['PENDING', 'WAITING_SIGN'] } },
      include: taskInclude as never,
      orderBy: { created_at: 'desc' },
    });
  }

  async processed(userId: string) {
    return this.prisma.approvalTask.findMany({
      where: { assignee_id: userId, status: { not: 'PENDING' } },
      include: taskInclude as never,
      orderBy: { created_at: 'desc' },
    });
  }

  async detail(taskId: string, userId: string) {
    const task = await this.prisma.approvalTask.findUnique({
      where: { id: taskId },
      include: {
        node: {
          include: {
            instance: {
              include: {
                nodes: { orderBy: { sequence: 'asc' } },
                contract: { include: { items: { include: { file: true } } } },
              },
            },
          },
        },
        actions: { orderBy: { created_at: 'asc' } },
      },
    });
    if (!task) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '任务不存在' });
    }
    const isAssignee = task.assignee_id === userId;
    const isApplicant =
      task.node.instance.contract?.applicant_id === userId;
    if (!isAssignee && !isApplicant) {
      const roles = await this.getRoleCodes(userId);
      if (!roles.includes('admin')) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权查看该任务' });
      }
    }
    return task;
  }

  // ---------- 同意 ----------

  async approve(taskId: string, userId: string) {
    const task = await this.loadTask(taskId);
    if (!task) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '任务不存在' });
    }
    if (task.assignee_id !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权处理该任务' });
    }
    if (task.status !== 'PENDING') {
      throw new ConflictException({ code: 'TASK_ALREADY_HANDLED', message: '任务已处理' });
    }

    return this.prisma.$transaction(async (tx) => {
      const lock = await tx.approvalTask.updateMany({
        where: { id: taskId, status: 'PENDING' },
        data: { status: 'APPROVED', completed_at: new Date() },
      });
      if (lock.count === 0) {
        throw new ConflictException({ code: 'TASK_ALREADY_HANDLED', message: '任务已被并发处理' });
      }

      const businessId = task.node.instance.business_id;

      if (task.task_type === 'SIGNATURE') {
        // 加签同意 → 恢复原任务
        await tx.approvalSignature.updateMany({
          where: { signature_task_id: taskId },
          data: { status: 'APPROVED', completed_at: new Date() },
        });
        const sig = await tx.approvalSignature.findUnique({
          where: { signature_task_id: taskId },
        });
        if (sig) {
          await tx.approvalTask.update({
            where: { id: sig.parent_task_id },
            data: { status: 'PENDING' },
          });
        }
        await tx.approvalAction.create({
          data: {
            instance_id: task.instance_id,
            node_id: task.node_id,
            task_id: taskId,
            actor_id: userId,
            action_type: 'SIGN_APPROVE',
          },
        });
        await this.logAudit(tx, userId, 'SIGN_APPROVE', businessId);
        return { status: 'APPROVED', signature: true };
      }

      // 常规审批：当前节点通过
      await tx.approvalNode.update({
        where: { id: task.node_id },
        data: { status: 'APPROVED', completed_at: new Date() },
      });
      const instance = await tx.approvalInstance.findUnique({
        where: { id: task.instance_id },
        include: { nodes: { orderBy: { sequence: 'asc' } } },
      });
      const nodes = instance?.nodes ?? [];
      const curIndex = nodes.findIndex((n) => n.id === task.node_id);
      const next = nodes[curIndex + 1];

      if (next) {
        // 激活下一节点 + 创建待办
        await tx.approvalNode.update({
          where: { id: next.id },
          data: { status: 'PENDING', activated_at: new Date() },
        });
        await tx.approvalTask.create({
          data: {
            instance_id: task.instance_id,
            node_id: next.id,
            assignee_id: next.approver_id,
            task_type: 'APPROVAL',
            status: 'PENDING',
          },
        });
      } else {
        // 最后节点 → 申请通过
        await tx.contract.update({
          where: { id: businessId },
          data: { status: 'APPROVED' },
        });
        await tx.approvalInstance.update({
          where: { id: task.instance_id },
          data: { status: 'APPROVED', completed_at: new Date() },
        });
      }

      await tx.approvalAction.create({
        data: {
          instance_id: task.instance_id,
          node_id: task.node_id,
          task_id: taskId,
          actor_id: userId,
          action_type: 'APPROVE',
        },
      });
      await this.logAudit(tx, userId, 'APPROVE', businessId);
      return { status: 'APPROVED' };
    });
  }

  // ---------- 驳回 ----------

  async reject(taskId: string, userId: string, dto: RejectDto) {
    const comment = (dto.comment ?? '').trim();
    if (comment.length < 10) {
      throw new BadRequestException({
        code: 'REASON_TOO_SHORT',
        message: '驳回原因不少于 10 个字',
      });
    }

    const task = await this.loadTask(taskId);
    if (!task) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '任务不存在' });
    }
    if (task.assignee_id !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权处理该任务' });
    }
    if (task.status !== 'PENDING') {
      throw new ConflictException({ code: 'TASK_ALREADY_HANDLED', message: '任务已处理' });
    }

    const isSignature = task.task_type === 'SIGNATURE';
    const businessId = task.node.instance.business_id;

    return this.prisma.$transaction(async (tx) => {
      const lock = await tx.approvalTask.updateMany({
        where: { id: taskId, status: 'PENDING' },
        data: { status: 'REJECTED', completed_at: new Date() },
      });
      if (lock.count === 0) {
        throw new ConflictException({ code: 'TASK_ALREADY_HANDLED', message: '任务已被并发处理' });
      }

      if (isSignature) {
        await tx.approvalSignature.updateMany({
          where: { signature_task_id: taskId },
          data: { status: 'REJECTED', completed_at: new Date() },
        });
        const sig = await tx.approvalSignature.findUnique({
          where: { signature_task_id: taskId },
        });
        if (sig) {
          await tx.approvalTask.updateMany({
            where: { id: sig.parent_task_id },
            data: { status: 'CANCELLED' },
          });
        }
      } else {
        await tx.approvalNode.update({
          where: { id: task.node_id },
          data: { status: 'REJECTED', completed_at: new Date() },
        });
      }

      // 申请整体驳回，后续任务/节点全部取消
      await tx.contract.update({
        where: { id: businessId },
        data: { status: 'REJECTED' },
      });
      await tx.approvalInstance.update({
        where: { id: task.instance_id },
        data: { status: 'REJECTED', completed_at: new Date() },
      });
      await tx.approvalTask.updateMany({
        where: { instance_id: task.instance_id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      await tx.approvalNode.updateMany({
        where: { instance_id: task.instance_id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });

      await tx.approvalAction.create({
        data: {
          instance_id: task.instance_id,
          node_id: task.node_id,
          task_id: taskId,
          actor_id: userId,
          action_type: isSignature ? 'SIGN_REJECT' : 'REJECT',
          comment,
        },
      });
      await this.logAudit(tx, userId, isSignature ? 'SIGN_REJECT' : 'REJECT', businessId, comment);
      return { status: 'REJECTED' };
    });
  }

  // ---------- 转交 ----------

  async transfer(taskId: string, userId: string, dto: TransferDto) {
    const comment = (dto.comment ?? '').trim();
    const task = await this.loadTask(taskId);
    if (!task) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '任务不存在' });
    }
    if (task.assignee_id !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权处理该任务' });
    }
    if (task.status !== 'PENDING') {
      throw new ConflictException({ code: 'TASK_ALREADY_HANDLED', message: '任务已处理' });
    }
    if (!comment) {
      throw new BadRequestException({ code: 'TRANSFER_REASON_REQUIRED', message: '请填写转交原因' });
    }

    const [toUser, assignee] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.toUserId } }),
      this.prisma.user.findUnique({ where: { id: task.assignee_id } }),
    ]);
    if (!toUser || toUser.status !== 'ACTIVE') {
      throw new BadRequestException({ code: 'TRANSFER_INVALID', message: '接收人无效或已禁用' });
    }
    if (toUser.department_id !== assignee?.department_id) {
      throw new BadRequestException({ code: 'TRANSFER_DEPT_MISMATCH', message: '只能转交给同部门人员' });
    }
    const toRoles = await this.prisma.userRole.findMany({
      where: { user_id: toUser.id },
      select: { role: { select: { code: true } } },
    });
    if (!toRoles.some((r) => r.role.code === 'approver')) {
      throw new BadRequestException({ code: 'TRANSFER_NO_APPROVAL', message: '接收人不具备审批权限' });
    }

    const businessId = task.node.instance.business_id;
    return this.prisma.$transaction(async (tx) => {
      const lock = await tx.approvalTask.updateMany({
        where: { id: taskId, status: 'PENDING' },
        data: { status: 'TRANSFERRED', completed_at: new Date() },
      });
      if (lock.count === 0) {
        throw new ConflictException({ code: 'TASK_ALREADY_HANDLED', message: '任务已被并发处理' });
      }
      await tx.approvalTask.create({
        data: {
          instance_id: task.instance_id,
          node_id: task.node_id,
          assignee_id: dto.toUserId,
          task_type: 'APPROVAL',
          status: 'PENDING',
        },
      });
      await tx.approvalAction.create({
        data: {
          instance_id: task.instance_id,
          node_id: task.node_id,
          task_id: taskId,
          actor_id: userId,
          action_type: 'TRANSFER',
          comment,
          from_user_id: userId,
          to_user_id: dto.toUserId,
        },
      });
      await this.logAudit(tx, userId, 'TRANSFER', businessId, comment);
      return { status: 'TRANSFERRED', toUserId: dto.toUserId };
    });
  }

  // ---------- 加签 ----------

  async addSign(taskId: string, userId: string, dto: AddSignDto) {
    const task = await this.loadTask(taskId);
    if (!task) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '任务不存在' });
    }
    if (task.assignee_id !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权处理该任务' });
    }
    if (task.status !== 'PENDING') {
      throw new ConflictException({ code: 'TASK_ALREADY_HANDLED', message: '任务已处理' });
    }
    if (task.task_type === 'SIGNATURE') {
      throw new BadRequestException({ code: 'ADD_SIGN_NOT_ALLOWED', message: '加签任务不能再加签' });
    }

    const [signer, assignee] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.signerId } }),
      this.prisma.user.findUnique({ where: { id: task.assignee_id } }),
    ]);
    if (!signer || signer.status !== 'ACTIVE') {
      throw new BadRequestException({ code: 'ADD_SIGN_INVALID', message: '加签人无效或已禁用' });
    }
    if ((signer.job_level ?? 0) < (assignee?.job_level ?? 0)) {
      throw new BadRequestException({ code: 'ADD_SIGN_LEVEL_LOW', message: '只能加签同级或上级审批人' });
    }
    const signerRoles = await this.prisma.userRole.findMany({
      where: { user_id: signer.id },
      select: { role: { select: { code: true } } },
    });
    if (!signerRoles.some((r) => r.role.code === 'approver')) {
      throw new BadRequestException({ code: 'ADD_SIGN_NO_APPROVAL', message: '加签人不具备审批资格' });
    }

    const businessId = task.node.instance.business_id;
    return this.prisma.$transaction(async (tx) => {
      const lock = await tx.approvalTask.updateMany({
        where: { id: taskId, status: 'PENDING' },
        data: { status: 'WAITING_SIGN' },
      });
      if (lock.count === 0) {
        throw new ConflictException({ code: 'TASK_ALREADY_HANDLED', message: '任务已被并发处理' });
      }
      const sigTask = await tx.approvalTask.create({
        data: {
          instance_id: task.instance_id,
          node_id: task.node_id,
          assignee_id: dto.signerId,
          task_type: 'SIGNATURE',
          status: 'PENDING',
        },
      });
      await tx.approvalSignature.create({
        data: {
          parent_task_id: taskId,
          signature_task_id: sigTask.id,
          signer_id: dto.signerId,
          status: 'PENDING',
        },
      });
      await tx.approvalAction.create({
        data: {
          instance_id: task.instance_id,
          node_id: task.node_id,
          task_id: taskId,
          actor_id: userId,
          action_type: 'ADD_SIGN',
          to_user_id: dto.signerId,
        },
      });
      await this.logAudit(tx, userId, 'ADD_SIGN', businessId);
      return { status: 'WAITING_SIGN', signerId: dto.signerId };
    });
  }

  // ---------- helpers ----------

  private loadTask(taskId: string) {
    return this.prisma.approvalTask.findUnique({
      where: { id: taskId },
      include: {
        node: { include: { instance: { include: { nodes: true } } } },
      },
    });
  }

  private logAudit(
    client: Db,
    actorId: string,
    action: string,
    resourceId: string,
    comment?: string,
  ) {
    return client.auditLog.create({
      data: {
        actor_id: actorId,
        action: action as never,
        resource_type: 'CONTRACT',
        resource_id: resourceId,
        before_snapshot: {},
        after_snapshot: comment ? { comment } : {},
      },
    });
  }

  private async getRoleCodes(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { user_id: userId },
      select: { role: { select: { code: true } } },
    });
    return rows.map((r) => r.role.code);
  }
}