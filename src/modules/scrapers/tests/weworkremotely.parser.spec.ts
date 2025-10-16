// src/modules/scrapers/__tests__/weworkremotely.scraper.spec.ts
import {
  runWeWorkRemotely,
  parseWeWorkRemotelyHtml,
} from '../weworkremotely.scraper';

describe('WeWorkRemotely Scraper', () => {
  describe('runWeWorkRemotely (integration)', () => {
    it('should fetch and parse jobs from weworkremotely.com', async () => {
      const jobs = await runWeWorkRemotely();

      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBeGreaterThan(0);

      const firstJob = jobs[0];
      expect(firstJob).toHaveProperty('title');
      expect(firstJob).toHaveProperty('url');
      expect(firstJob).toHaveProperty('company');
      expect(firstJob).toHaveProperty('location');
      expect(firstJob).toHaveProperty('tags');
      expect(firstJob).toHaveProperty('description');
      expect(firstJob).toHaveProperty('salary');

      expect(typeof firstJob.title).toBe('string');
      expect(firstJob.title.length).toBeGreaterThan(0);
      expect(typeof firstJob.url).toBe('string');
      expect(firstJob.url).toMatch(/^https?:\/\//);

      if (firstJob.company) {
        expect(typeof firstJob.company).toBe('string');
      }

      if (firstJob.tags) {
        expect(Array.isArray(firstJob.tags)).toBe(true);
      }
    }, 30000);

    it('should return unique jobs by URL', async () => {
      const jobs = await runWeWorkRemotely();
      const urls = jobs.map((job) => job.url);
      const uniqueUrls = new Set(urls);

      // Since we dedupe in the scraper, all URLs should be unique
      expect(urls.length).toBe(uniqueUrls.size);
    }, 30000);
  });

  describe('parseWeWorkRemotelyHtml (unit)', () => {
    it('should parse HTML with job listings', () => {
      const mockHtml = `
        <html>
          <body>
            <section class="jobs">
              <ul>
                <li>
                  <a href="/remote-jobs/backend-developer-123">
                    <span class="title">Backend Developer</span>
                    <span class="company">TechCorp</span>
                    <span class="region">Anywhere</span>
                  </a>
                  <span class="tags">
                    <a>Node.js</a>
                    <a>TypeScript</a>
                  </span>
                  <div class="listing-container">
                    <p>Great opportunity</p>
                  </div>
                </li>
                <li class="view-all">View All</li>
                <li>
                  <a href="/remote-jobs/frontend-developer-456">
                    <span class="title">Frontend Developer</span>
                    <span class="company">StartupXYZ</span>
                  </a>
                </li>
              </ul>
            </section>
          </body>
        </html>
      `;

      const jobs = parseWeWorkRemotelyHtml(mockHtml);

      expect(jobs.length).toBe(2);
      expect(jobs[0].title).toBe('Backend Developer');
      expect(jobs[0].company).toBe('TechCorp');
      expect(jobs[0].location).toBe('Anywhere');
      expect(jobs[0].tags).toEqual(['Node.js', 'TypeScript']);
      expect(jobs[0].description).toBe('Great opportunity');
      expect(jobs[0].url).toContain('/remote-jobs/backend-developer-123');

      expect(jobs[1].title).toBe('Frontend Developer');
      expect(jobs[1].company).toBe('StartupXYZ');
    });

    it('should handle empty HTML', () => {
      const jobs = parseWeWorkRemotelyHtml('<html><body></body></html>');
      expect(jobs.length).toBe(0);
    });

    it('should skip view-all and heading elements', () => {
      const mockHtml = `
        <section class="jobs">
          <ul>
            <li class="heading">Jobs</li>
            <li class="view-all">View All</li>
            <li>
              <a href="/job-1">
                <span class="title">Real Job</span>
              </a>
            </li>
          </ul>
        </section>
      `;

      const jobs = parseWeWorkRemotelyHtml(mockHtml);
      expect(jobs.length).toBe(1);
      expect(jobs[0].title).toBe('Real Job');
    });

    it('should add full URL if href is relative', () => {
      const mockHtml = `
        <section class="jobs">
          <ul>
            <li>
              <a href="/remote-jobs/test-job">
                <span class="title">Test Job</span>
              </a>
            </li>
          </ul>
        </section>
      `;

      const jobs = parseWeWorkRemotelyHtml(mockHtml);
      expect(jobs[0].url).toBe(
        'https://weworkremotely.com/remote-jobs/test-job',
      );
    });
  });
});
