// src/modules/users/users.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateFromAuth0(payload: {
    auth0Id: string;
    email?: string;
    name?: string;
  }) {
    const { auth0Id, email, name } = payload;
    const user = await this.prisma.user.upsert({
      where: { auth0Id },
      update: {
        email: email ?? undefined,
        name: name ?? undefined,
      },
      create: {
        auth0Id,
        email: email ?? '',
        name: name ?? '',
      },
    });
    return user;
  }

  async findByAuth0Id(auth0Id: string) {
    return this.prisma.user.findUnique({ where: { auth0Id } });
  }

  async updateProfile(
    auth0Id: string,
    data: { name?: string; skills?: string[]; preferences?: any },
  ) {
    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.skills !== undefined) payload.skills = data.skills;
    if (data.preferences !== undefined) payload.preferences = data.preferences;
    return this.prisma.user.update({
      where: { auth0Id },
      data: payload,
    });
  }

  async updateResumeUrl(auth0Id: string, resumeUrl: string) {
    return this.prisma.user.update({
      where: { auth0Id },
      data: { resumeUrl },
    });
  }

  async updateResumeAndText(
    auth0Id: string,
    resumeUrl: string,
    resumeText: string,
  ) {
    return this.prisma.user.update({
      where: { auth0Id },
      data: { resumeUrl, resumeText },
    });
  }
}
