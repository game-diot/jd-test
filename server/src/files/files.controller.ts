import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser, JwtUser, Public } from '../auth/decorators.js';
import { FilesService } from './files.service.js';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MiB

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private files: FilesService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: '请选择要上传的文件',
      });
    }
    return this.files.save(file, user.userId);
  }

  @Get(':id')
  metadata(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.files.getMeta(id, user.userId);
  }

  @Post(':id/download-url')
  downloadUrl(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.files.getDownloadUrl(id, user.userId);
  }

  @Public()
  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const { stream, name, mime } = await this.files.resolveDownload(id, token);
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    );
    stream.pipe(res);
  }
}