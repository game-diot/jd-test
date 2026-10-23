import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MiB

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {}

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

  /** PDF 校验：检查文件头 magic number，而非仅依赖扩展名/MIME */
  private isPdf(buf: Buffer): boolean {
    return buf.length >= 5 && buf.subarray(0, 5).toString() === '%PDF-';
  }
}