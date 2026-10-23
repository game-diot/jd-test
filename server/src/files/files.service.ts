import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MiB

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async save(file: Express.Multer.File, userId: string) {
    if (!this.isPdf(file.buffer)) {
      throw new BadRequestException({
        code: 'INVALID_PDF',
        message: '仅支持 PDF 文件',
      });
    }
    if (file.size > MAX_SIZE) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: '文件不能超过 10 MiB',
      });
    }

    const id = randomUUID();
    const storageKey = `${id}.pdf`;
    const dir = path.resolve(process.env.FILE_STORAGE_DIR || './storage/files');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, storageKey), file.buffer);

    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    const record = await this.prisma.file.create({
      data: {
        storage_key: storageKey,
        original_name: file.originalname || 'contract.pdf',
        mime_type: file.mimetype || 'application/pdf',
        size_bytes: file.size,
        checksum,
        uploaded_by: userId,
      },
    });

    return {
      id: record.id,
      name: record.original_name,
      size: Number(record.size_bytes),
      status: record.status,
    };
  }

  /** 二次鉴权：签发短时效下载 token（5 分钟），不暴露静态地址 */
  async getDownloadUrl(fileId: string, userId: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '文件不存在' });
    }
    if (file.uploaded_by !== userId) {
      const roles = await this.getRoleCodes(userId);
      if (!roles.includes('admin')) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权下载该附件' });
      }
    }
    const token = await this.jwt.signAsync(
      { fileId, uid: userId },
      { expiresIn: 300 },
    );
    return {
      url: `/api/v1/files/${fileId}/download?token=${token}`,
      expiresIn: 300,
    };
  }

  /** 校验下载 token 并返回文件流 */
  async resolveDownload(fileId: string, token: string) {
    let payload: { fileId: string; uid: string };
    try {
      payload = await this.jwt.verifyAsync<{ fileId: string; uid: string }>(
        token,
      );
    } catch {
      throw new ForbiddenException({
        code: 'TOKEN_INVALID',
        message: '下载链接已过期或无效',
      });
    }
    if (payload.fileId !== fileId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '下载链接无效' });
    }
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '文件不存在' });
    }
    const dir = path.resolve(process.env.FILE_STORAGE_DIR || './storage/files');
    return {
      stream: createReadStream(path.join(dir, file.storage_key)),
      name: file.original_name,
      mime: file.mime_type || 'application/pdf',
    };
  }

  private async getRoleCodes(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { user_id: userId },
      select: { role: { select: { code: true } } },
    });
    return rows.map((r) => r.role.code);
  }

  /** PDF 校验：检查文件头 magic number，而非仅依赖扩展名/MIME */
  private isPdf(buf: Buffer): boolean {
    return buf.length >= 5 && buf.subarray(0, 5).toString() === '%PDF-';
  }
}