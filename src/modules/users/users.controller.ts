// src/modules/users/users.controller.ts
import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { CloudinaryService } from '../files/cloudinary.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private cloudinary: CloudinaryService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async me(
    @CurrentUser() user: { auth0Id: string; email?: string; name?: string },
  ) {
    return this.usersService.findOrCreateFromAuth0(user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('me')
  async updateMe(
    @CurrentUser() user: { auth0Id: string },
    @Body() body: { name?: string; skills?: string[]; preferences?: any },
  ) {
    return this.usersService.updateProfile(user.auth0Id, body);
  }

  // Resume upload: file field name = "file"
  @UseGuards(AuthGuard('jwt'))
  @Post('me/resume')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadResume(
    @CurrentUser() user: { auth0Id: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('No file provided');
    }
    const upload = await this.cloudinary.uploadBuffer(file.buffer, file.originalname);
    // upload.secure_url (Cloudinary response)
    const saved = await this.usersService.updateResumeUrl(
      user.auth0Id,
      upload.secure_url,
    );
    return saved;
  }
}
