/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './config/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getHello() {
    return {
      message: 'Welcome to SmartHunter API',
      status: 'running',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  async healthCheck() {
    try {
      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        database: 'disconnected',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('users')
  async getUsers() {
    const users = await this.prisma.user.findMany();
    return {
      count: users.length,
      data: users,
    };
  }

  @Get('jobs')
  async getJobs() {
    const jobs = await this.prisma.job.findMany();
    return {
      count: jobs.length,
      data: jobs,
    };
  }
}
