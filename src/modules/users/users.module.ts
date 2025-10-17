// src/modules/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { DatabaseModule } from '../database/database.module';
import { CloudinaryService } from '../files/cloudinary.service';
import { AuthModule } from '../auth/auth.module';
import { ResumeService } from '../files/resume.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService, CloudinaryService, ResumeService],
  exports: [UsersService],
})
export class UsersModule {}
