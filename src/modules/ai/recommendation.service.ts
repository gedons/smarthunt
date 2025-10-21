// src/modules/ai/recommendation.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { EmbeddingsService } from './embeddings.service';

@Injectable()
export class RecommendationService {
  constructor(private prisma: PrismaService, private embedService: EmbeddingsService) {}

  // auth0Id -> top-k jobs
  async recommendForUser(auth0Id: string, opts: { page?: number; perPage?: number } = {}) {
    const page = opts.page ?? 0;
    const perPage = opts.perPage ?? 10;

    const user = await this.prisma.user.findUnique({ where: { auth0Id } });
    if (!user) throw new Error('User not found');

    // ensure user vector exists
    let userVector = user.vector;
    if (!userVector || userVector.length === 0) {
      userVector = await this.embedService.embedUser(auth0Id);
    }

    // build a vector literal for SQL: '[0.1,0.2,...]'
    const vecLiteral = '[' + userVector.map((v) => Number(v).toFixed(12)).join(',') + ']';

    const sql = `
      SELECT jb."jobId", j.title, jb.embedding_vector <=> '${vecLiteral}' AS distance
      FROM "JobEmbedding" jb
      JOIN "Job" j ON jb."jobId" = j.id
      ORDER BY distance ASC
      LIMIT $1 OFFSET $2
    `;
    // NOTE: prisma.$queryRawUnsafe used below; ensure vecLiteral is numeric-only string (we control it) to avoid injection
    const rows: Array<{ jobId: string; title: string; distance: number }> = await this.prisma.$queryRawUnsafe(sql, perPage, page * perPage);

    // fetch full jobs for returned ids (or join earlier as shown)
    const jobIds = rows.map(r => r.jobId);
    const jobs = await this.prisma.job.findMany({ where: { id: { in: jobIds } } });

    // re-order jobs to match rows order
    const jobsById = new Map(jobs.map(j => [j.id, j]));
    return rows.map(r => ({ job: jobsById.get(r.jobId), score: 1 - r.distance }));
  }
}
