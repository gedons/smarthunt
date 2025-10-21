// src/modules/scrapers/weworkremotely.scraper.ts
import * as cheerio from 'cheerio';
import { PrismaService } from '../../config/prisma.service';

export type ParsedJob = {
  title: string;
  company?: string | null;
  url: string;
  location?: string | null;
  tags?: string[];
  description?: string | null;
  salary?: string | null;
};

export async function runWeWorkRemotely(prisma: PrismaService) {
  const start = Date.now();
  console.log('[WWR] fetching remote-jobs page');
  const response = await fetch('https://weworkremotely.com/remote-jobs');
  const html: string = await response.text();
  const jobs = parseWeWorkRemotelyHtml(html);
  console.log(`[WWR] parsed ${jobs.length} jobs`);

  const saved: string[] = [];

  for (const j of jobs) {
    if (!j || !j.url || !j.title) {
      console.warn('[WWR] skipping invalid job', j);
      continue;
    }

    try {
      const res = await prisma.job.upsert({
        where: { url: j.url },
        update: {
          title: j.title,
          company: j.company,
          location: j.location,
          description: j.description,
          tags: j.tags || [],
          salary: j.salary,
          scrapedAt: new Date(),
        },
        create: {
          title: j.title,
          company: j.company,
          url: j.url,
          location: j.location,
          description: j.description,
          tags: j.tags || [],
          salary: j.salary,
          source: 'WEWORKREMOTELY',
        },
      });
      saved.push(res.id); 
      console.log('[Weworkremotely] saved:', res.id);

    } catch (err) {
      console.error('[Weworkremotely] prisma upsert error for', j.url, err);
    }
  }

  console.log(
    `[WWR] finished. saved=${saved.length}. took=${Date.now() - start}ms`,
  );
  return { count: saved.length, insertedIds: saved };
}

export function parseWeWorkRemotelyHtml(html: string): ParsedJob[] {
  const $ = cheerio.load(html);
  const out: ParsedJob[] = [];
  const seenUrls = new Set<string>();

  $('section.jobs li').each((i, el) => {
    const el$ = $(el);
    if (el$.hasClass('view-all') || el$.hasClass('heading')) return;

    const title = el$.find('span.title').first().text().trim() || el$.find('a').text().trim();
    const company = el$.find('span.company').first().text().trim() || null;
    const relative = el$.find('a').attr('href') || '';
    const url = relative.startsWith('http') ? relative : `https://weworkremotely.com${relative}`;
    const location = el$.find('span.region').first().text().trim() || null;
    const tags = el$.find('span.tags a').map((i, t) => $(t).text().trim()).get() || [];
    const description = el$.find('div.listing-container p').text().trim() || null;

    if (title && url && !seenUrls.has(url)) {
      seenUrls.add(url);
      out.push({
        title,
        company,
        url,
        location,
        tags,
        description,
        salary: null,
      });
    }
  });

  return out;
}
