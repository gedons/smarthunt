// src/modules/scrapers/index.ts
import { PrismaService } from '../../config/prisma.service';
//import { runRemoteOK } from './remoteok.scraper';
import { runWeWorkRemotely } from './weworkremotely.scraper';
import { runWellfound } from './wellfound.scraper';

export async function runScraperForSource(
  source: string,
  prisma: PrismaService,
) {
  const s = (source || '').toUpperCase();
  //if (s === 'REMOTEOK') return runRemoteOK();
  if (s === 'WEWORKREMOTELY') return runWeWorkRemotely(prisma);
  if (s === 'WELLFOUND') return runWellfound(prisma);
  throw new Error(`Unknown source ${source}`);
}
