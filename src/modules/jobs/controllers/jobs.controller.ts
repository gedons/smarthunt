import { Controller, Get, Post, Body, UseGuards, Query, Req, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JobsService } from '../services/jobs.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RecommendationService } from '../../ai/recommendation.service';
import { PrismaService } from '../../../config/prisma.service';
import { GeminiService } from '../../ai/gemini.service';

@Controller('jobs')
export class JobsController { 
  constructor(
    private readonly jobsService: JobsService,
    private rec: RecommendationService,
    private prisma: PrismaService,
    private gemini: GeminiService,
  ) {}

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

  
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('recommended')
  async recommended(@Req() req, @Query('page') page = '0', @Query('perPage') perPage = '10') {
    const auth0Id = req.user.auth0Id;
    const p = await this.rec.recommendForUser(auth0Id, { page: Number(page), perPage: Number(perPage) });
    return p;
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post(':id/cover-letter')
  async coverLetter(@Req() req, @Param('id') id: string) {
    const auth0Id = req.user.auth0Id;    
    const job = await this.prisma.job.findUnique({ where: { id } });
    const user = await this.prisma.user.findUnique({ where: { auth0Id } });
    if (!job || !user) throw new Error('Not found');

    const prompt = `Write a concise professional cover letter for ${user.name || 'Applicant'} applying to ${job.title} at ${job.company || ''}.
    Job description:
    ${job.description || ''}

    Resume (key points):
    ${(user.resumeText || '').slice(0, 4000)}

    Limit to 300-500 words, emphasise achievements relevant to this job.`;
        const letter = await this.gemini.generate(prompt, { maxTokens: 800 });
        return { coverLetter: letter };
  }
}
