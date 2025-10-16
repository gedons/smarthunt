import { Controller, Get, Post, Body } from '@nestjs/common';
import { JobsService } from '../services/jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  async list() {
    /* eslint-disable @typescript-eslint/require-await */
    return this.jobsService.listRecent(50);
  }

  @Post('scrape')
  async triggerScrape(@Body('source') source: string) {
    // trigger scraping job via queue
    return this.jobsService.queueScrape(source || 'REMOTEOK');
  }
}
