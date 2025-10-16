// src/modules/files/cloudinary.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: config.get('CLOUDINARY_CLOUD_NAME'),
      api_key: config.get('CLOUDINARY_API_KEY'),
      api_secret: config.get('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  async uploadBuffer(buffer: Buffer, filename = 'file') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder: 'resumes' },
        (error, result) => {
          if (error) {
            this.logger.error('Cloudinary upload error', error);
            return reject(error);
          }
          resolve(result);
        },
      );
      stream.end(buffer);
    });
  }
}
