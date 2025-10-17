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
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { CloudinaryService } from '../files/cloudinary.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { resumeFileFilter } from 'src/common/multer/resume-filter';
import { ResumeService } from '../files/resume.service';

@Controller('auth')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private resumeService: ResumeService,
    private cloudinary: CloudinaryService,
  ) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me')
  @Roles('USER')
  async me(
    @CurrentUser() user: { auth0Id: string; email?: string; name?: string },
  ) {
    return this.usersService.findOrCreateFromAuth0(user);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch('me')
  @Roles('USER')
  async updateMe(
    @CurrentUser() user: { auth0Id: string },
    @Body() body: { name?: string; skills?: string[]; preferences?: any },
  ) {
    return this.usersService.updateProfile(user.auth0Id, body);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('me/resume')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 6 * 1024 * 1024 },
      fileFilter: resumeFileFilter,
    }),
  )
  async uploadResume(
    @CurrentUser() user: { auth0Id: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');

    console.log(
      '[uploadResume] file.mimetype=',
      file.mimetype,
      'size=',
      file.size,
      'originalname=',
      file.originalname,
    );

    // upload to cloudinary
    const upload = await this.cloudinary.uploadBuffer(file.buffer, file.originalname);
    console.log('[uploadResume] uploaded to Cloudinary:', upload?.secure_url);

    // extract text
    const resumeText = await this.resumeService.extractText(file.buffer, file.mimetype);
    console.log('[uploadResume] extracted text length=', resumeText?.length);

    // return the text in the response and persist it
    const updated = await this.usersService.updateResumeAndText(user.auth0Id, upload.secure_url, resumeText ?? '');

    console.log(
      '[uploadResume] DB update result auth0Id=',
      updated.auth0Id,
      'resumeUrl=',
      updated.resumeUrl,
      'resumeTextLength=',
      (updated.resumeText || '').length,
    );

    // return extracted text immediately for debugging (remove in prod)
    return {
      ok: true,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      resumeUrl: upload?.secure_url,
      resumeTextLength: resumeText?.length ?? 0,
      resumeTextSnippet: resumeText?.slice(0, 500) ?? '',
    };
  }
}
