// src/modules/scrapers/wellfound.scraper.ts
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

export async function runWellfound(prisma: PrismaService) {
  const start = Date.now();
  console.log('[Wellfound] fetching /jobs page');
  const response = await fetch('https://wellfound.com/jobs');
  const html: string = await response.text();
  const jobs = parseWellfoundHtml(html);
  console.log(`[Wellfound] parsed ${jobs.length} jobs`);

  const saved: string[] = [];

  for (const j of jobs) {
    if (!j || !j.url || !j.title) {
      console.warn('[Wellfound] skipping invalid job', j && j.url);
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
      console.log('[Wellfound] saved:', res.id);
    } catch (err) {
      console.error('[Wellfound] prisma upsert error for', j.url, err);
    }
  }

  console.log(
    `[Wellfound] finished. saved=${saved.length}. took=${Date.now() - start}ms`,
  );
  return { count: saved.length, insertedIds: saved };

}

export function parseWellfoundHtml(html: string) {
  const $ = cheerio.load(html);
  const out: ParsedJob[] = [];

  // Prefer anchors with '/jobs/' in href
  const anchors = $('a[href*="/jobs/"]');

  anchors.each((i, el) => {
    const el$ = $(el);
    const href = el$.attr('href') || '';
    const url = href.startsWith('http') ? href : `https://wellfound.com${href}`;
    const title =
      el$.find('[data-test="job-title"]').text().trim() ||
      el$.find('.job-title').text().trim() ||
      el$.text().trim();
    const company =
      el$.find('[data-test="company-name"]').text().trim() ||
      el$.find('.company-name').text().trim() ||
      null;
    const location = el$.find('.location').text().trim() || null;
    const tags =
      el$
        .find('.tags .tag')
        .map((i, t) => $(t).text().trim())
        .get() || [];

    if (title && url) {
      out.push({
        title,
        company,
        url,
        location,
        tags,
        description: null,
        salary: null,
      });
    }
  });

  // dedupe by url
  const byUrl = new Map<string, ParsedJob>();
  for (const j of out) if (!byUrl.has(j.url)) byUrl.set(j.url, j);
  return Array.from(byUrl.values());
}
