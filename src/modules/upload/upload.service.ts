import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export interface CloudinaryResponse {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

@Injectable()
export class UploadService {
  constructor(private config: ConfigService) {
    cloudinary.config({
      cloud_name: config.get('CLOUDINARY_CLOUD_NAME'),
      api_key: config.get('CLOUDINARY_API_KEY'),
      api_secret: config.get('CLOUDINARY_API_SECRET'),
    });
  }

  // ─── Upload single image ────────────────────────────────────
  async uploadImage(
    file: Express.Multer.File,
    folder = 'pakverse',
  ): Promise<CloudinaryResponse> {
    this.validateImageFile(file);

    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            resource_type: 'image',
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
          },
          (error, result) => {
            if (error || !result) return reject(error ?? new Error('Upload failed'));
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              width: result.width,
              height: result.height,
              format: result.format,
              bytes: result.bytes,
            });
          },
        )
        .end(file.buffer);
    });
  }

  // ─── Upload multiple images ────────────────────────────────
  async uploadImages(
    files: Express.Multer.File[],
    folder = 'pakverse',
  ): Promise<CloudinaryResponse[]> {
    if (files.length > 5) {
      throw new BadRequestException('Maximum 5 images allowed');
    }
    return Promise.all(files.map((file) => this.uploadImage(file, folder)));
  }

  // ─── Upload video ─────────────────────────────────────────
  async uploadVideo(
    file: Express.Multer.File,
    folder = 'pakverse/videos',
  ): Promise<CloudinaryResponse> {
    this.validateVideoFile(file);

    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder, resource_type: 'video' },
          (error, result) => {
            if (error || !result) return reject(error ?? new Error('Upload failed'));
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              bytes: result.bytes,
            });
          },
        )
        .end(file.buffer);
    });
  }

  // ─── Delete file ──────────────────────────────────────────
  async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  // ─── Validation helpers ───────────────────────────────────
  private validateImageFile(file: Express.Multer.File) {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: JPEG, PNG, WebP, GIF`,
      );
    }
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('Image size must be less than 10MB');
    }
  }

  private validateVideoFile(file: Express.Multer.File) {
    const allowedMimes = ['video/mp4', 'video/mpeg', 'video/webm', 'video/quicktime'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid video type. Allowed: MP4, MPEG, WebM, MOV');
    }
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new BadRequestException('Video size must be less than 50MB');
    }
  }
}
