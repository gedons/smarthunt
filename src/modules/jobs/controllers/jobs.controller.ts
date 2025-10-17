import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JobsService } from '../services/jobs.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get()
  @Roles('USER')
  async list() {
    return this.jobsService.listRecent(50);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('scrape')
  @Roles('USER')
  async triggerScrape(@Body('source') source: string) {
    // trigger scraping job via queue
    return this.jobsService.queueScrape(source || 'REMOTEOK');
  }
}
