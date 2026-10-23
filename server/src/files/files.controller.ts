import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../auth/decorators.js';
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
}