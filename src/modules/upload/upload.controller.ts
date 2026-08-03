import {
  Controller,
  Post,
  Delete,
  Param,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file', { storage: undefined as any }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload a single image to Cloudinary' })
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    const result = await this.uploadService.uploadImage(file);
    return { message: 'Image uploaded', data: result };
  }

  @Post('images')
  @UseInterceptors(FilesInterceptor('files', 5, { storage: undefined as any }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } } } })
  @ApiOperation({ summary: 'Upload up to 5 images to Cloudinary' })
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    const results = await this.uploadService.uploadImages(files);
    return { message: `${results.length} images uploaded`, data: results };
  }

  @Post('video')
  @UseInterceptors(FileInterceptor('file', { storage: undefined as any }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload a video to Cloudinary (max 50MB)' })
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    const result = await this.uploadService.uploadVideo(file);
    return { message: 'Video uploaded', data: result };
  }

  @Delete(':publicId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a file from Cloudinary by public ID' })
  async deleteFile(@Param('publicId') publicId: string) {
    await this.uploadService.deleteFile(publicId);
    return { message: 'File deleted successfully' };
  }
}
