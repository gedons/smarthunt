import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { EmbeddingsService } from './embeddings.service';

function dot(a: number[], b: number[]) { return a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0); }
function norm(a: number[]) { return Math.sqrt(a.reduce((s, v) => s + v * v, 0)); }
function cosine(a: number[], b: number[]) {
  const n = norm(a) * norm(b);
  return n === 0 ? 0 : dot(a, b) / n;
}

@Injectable()
export class RecommendationService {
  constructor(private prisma: PrismaService, private embedService: EmbeddingsService) {}

  // get top recommendations for a user
  async recommendForUser(auth0Id: string, { page = 0, perPage = 10 }: { page?: number; perPage?: number } = {}) {
    const user = await this.prisma.user.findUnique({ where: { auth0Id } });
    if (!user) throw new Error('User not found');

    // ensure user vector exists
    let userVector = user.vector;
    if (!userVector || userVector.length === 0) {
      userVector = await this.embedService.embedUser(auth0Id);
    }

    // fetch candidate job embeddings (limit to 2000 for speed)
    const candidates = await this.prisma.jobEmbedding.findMany({
      take: 2000, 
      include: { job: true },
    });

    // score and sort
    const scored = candidates.map((c) => {
      const score = cosine(userVector!, c.embedding);
      return { job: c.job, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // pagination
    const start = page * perPage;
    const slice = scored.slice(start, start + perPage);

    return slice.map((s) => ({ job: s.job, score: s.score }));
  }
}
