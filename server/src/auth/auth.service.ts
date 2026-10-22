import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.account }, { employee_no: dto.account }],
      },
    });
    const passwordOk = user
      ? await bcrypt.compare(dto.password, user.password_hash)
      : false;
    if (!user || !passwordOk) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: '账号或密码错误',
      });
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message: '账号已被禁用',
      });
    }

    const roles = await this.prisma.role.findMany({
      where: { userRoles: { some: { user_id: user.id } } },
      select: { code: true },
    });
    const roleCodes = roles.map((r) => r.code);

    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      roles: roleCodes,
    });

    return { token, profile: await this.buildProfile(user.id) };
  }

  async me(userId: string) {
    const profile = await this.buildProfile(userId);
    if (!profile) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '用户不存在',
      });
    }
    return profile;
  }

  private async buildProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: { select: { name: true } },
        roles: { include: { role: { select: { code: true } } } },
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      employeeNo: user.employee_no,
      name: user.name,
      email: user.email,
      departmentId: user.department_id,
      departmentName: user.department?.name ?? null,
      jobLevel: user.job_level,
      status: user.status,
      roles: user.roles.map((ur) => ur.role.code),
    };
  }
}