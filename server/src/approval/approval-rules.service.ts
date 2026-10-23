import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { NodeType, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

type Db = PrismaService | Prisma.TransactionClient;

/**
 * 审批规则引擎：金额三档路由 + 审批人解析。
 * 规则只影响新提交的申请；已提交申请使用快照，不受规则变更影响。
 */
@Injectable()
export class ApprovalRulesService {
  constructor(private prisma: PrismaService) {}

  /** 金额 → 审批节点序列（后端裁决，客户端计算的链不被信任） */
  computeRoute(total: number): NodeType[] {
    if (total < 500000) return ['DEPARTMENT_MANAGER'];
    if (total < 2000000) return ['DEPARTMENT_MANAGER', 'LEGAL_REVIEW'];
    return ['DEPARTMENT_MANAGER', 'LEGAL_REVIEW', 'CFO'];
  }

  /** 解析某节点的审批人；找不到或账号被禁用 → null（提交必须失败，不跳过） */
  async resolveApprover(
    nodeType: NodeType,
    departmentId: string,
    db: Db = this.prisma,
  ): Promise<User | null> {
    if (nodeType === 'DEPARTMENT_MANAGER') {
      const dept = await db.department.findUnique({
        where: { id: departmentId },
        include: { manager: true },
      });
      return dept?.manager?.status === 'ACTIVE' ? dept.manager : null;
    }
    const pos = await db.approvalPosition.findUnique({
      where: { code: nodeType },
      include: {
        assignees: {
          where: { is_active: true },
          take: 1,
          include: { user: true },
        },
      },
    });
    const user = pos?.assignees[0]?.user;
    return user && user.status === 'ACTIVE' ? user : null;
  }
}