import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module.js';
import { ExportsController } from './exports.controller.js';
import { ExportsService } from './exports.service.js';

@Module({
  imports: [FilesModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}