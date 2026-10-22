import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { CurrentUser, JwtUser, Public } from './decorators.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('logout')
  logout() {
    // 无状态 JWT：前端丢弃 token 即可；审计落库在后续阶段接入
    return { message: 'ok' };
  }

  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.auth.me(user.userId);
  }
}