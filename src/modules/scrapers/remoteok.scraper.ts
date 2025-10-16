// src/modules/scrapers/remoteok.scraper.ts
import * as cheerio from 'cheerio';

export type ParsedJob = {
  title: string;
  company?: string | null;
  url: string;
  location?: string | null;
  tags?: string[];
  description?: string | null;
  salary?: string | null;
};

export async function runRemoteOK() {
  const response = await fetch('https://remoteok.com/', {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });
  const html: string = await response.text();
  return parseRemoteOKHtml(html);
}

export function parseRemoteOKHtml(html: string): ParsedJob[] {
  const $ = cheerio.load(html);
  const out: ParsedJob[] = [];

  $('tr.job, table tr[data-id]').each((_, el) => {
    const el$ = $(el);

    // Skip if it's a header or doesn't have an ID
    if (
      el$.hasClass('header') ||
      (!el$.hasClass('job') && !el$.attr('data-id'))
    ) {
      return;
    }

    const title = el$.find('h2, .company_and_position h2').text().trim();
    const company = el$.find('.companyLink, .company h3').text().trim() || null;

    // Try multiple link selectors
    let link = el$.find('a.preventLink').attr('href') || 
               el$.find('td.company a').attr('href') ||
               el$.find('a[href^="/remote-jobs/"]').first().attr('href') || '';

    const url = link.startsWith('http') ? link : `https://remoteok.com${link}`;

    const tags = el$.find('.tags a, .tag').map((i, t) => $(t).text().trim()).get().filter(t => t) || [];
    const description = el$.find('.description, .markdown').text().trim() || null;
    const location = el$.find('.location, [class*="location"]').text().trim() || null;
    const salary = el$.find('.salary, [class*="salary"]').text().trim() || null;

    if (title && url && url !== 'https://remoteok.com') {
      out.push({ 
        title, 
        company, 
        url, 
        location,
        tags, 
        description,
        salary,
      });
    }
  });
  return out;
}