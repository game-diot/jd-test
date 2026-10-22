import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** 标记为公共路由（跳过 JWT 校验） */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** 角色守卫：要求当前用户至少具备其中一个角色 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export interface JwtUser {
  userId: string;
  email: string;
  roles: string[];
}

/** 从请求上下文取当前登录用户（JWT payload） */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as JwtUser;
  },
);