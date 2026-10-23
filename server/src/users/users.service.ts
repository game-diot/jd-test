import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /** 转交对象：同部门 + 具备审批资格 + 有效账号（排除本人） */
  async listApprovers(userId: string) {
    const me = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!me) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '用户不存在' });
    }
    return this.prisma.user.findMany({
      where: {
        id: { not: userId },
        department_id: me.department_id,
        status: 'ACTIVE',
        roles: { some: { role: { code: 'approver' } } },
      },
      select: {
        id: true,
        name: true,
        employee_no: true,
        department_id: true,
        job_level: true,
      },
      orderBy: { job_level: 'desc' },
    });
  }

  /** 加签对象：同级或上级（job_level >= 本人）+ 审批资格 + 有效账号 */
  async listSigners(userId: string) {
    const me = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!me) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '用户不存在' });
    }
    return this.prisma.user.findMany({
      where: {
        id: { not: userId },
        status: 'ACTIVE',
        job_level: { gte: me.job_level },
        roles: { some: { role: { code: 'approver' } } },
      },
      select: {
        id: true,
        name: true,
        employee_no: true,
        department_id: true,
        job_level: true,
      },
      orderBy: { job_level: 'asc' },
    });
  }
}