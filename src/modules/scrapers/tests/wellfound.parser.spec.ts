import { runWellfound, parseWellfoundHtml } from '../wellfound.scraper';

describe('Wellfound Scraper', () => {
  describe('runWellfound (integration)', () => {
    it('should fetch and parse jobs from wellfound.com', async () => {
      const jobs = await runWellfound();

      expect(Array.isArray(jobs)).toBe(true);

      if (jobs.length > 0) {
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
      }
    }, 30000);

    it('should return unique jobs by URL', async () => {
      const jobs = await runWellfound();

      if (jobs.length > 0) {
        const urls = jobs.map((job) => job.url);
        const uniqueUrls = new Set(urls);
        expect(urls.length).toBe(uniqueUrls.size);
      }
    }, 30000);
  });

  describe('parseWellfoundHtml (unit)', () => {
    it('should parse HTML with job listings', () => {
      const mockHtml = `
        <html>
          <body>
            <a href="/jobs/12345">
              <div data-test="job-title">Senior Developer</div>
              <div data-test="company-name">Tech Corp</div>
              <div class="location">Remote</div>
              <div class="tags">
                <span class="tag">JavaScript</span>
                <span class="tag">React</span>
              </div>
            </a>
            <a href="/jobs/67890">
              <div data-test="job-title">Product Manager</div>
              <div data-test="company-name">Startup Inc</div>
              <div class="location">San Francisco</div>
            </a>
          </body>
        </html>
      `;

      const jobs = parseWellfoundHtml(mockHtml);

      expect(jobs.length).toBe(2);

      expect(jobs[0].title).toBe('Senior Developer');
      expect(jobs[0].company).toBe('Tech Corp');
      expect(jobs[0].location).toBe('Remote');
      expect(jobs[0].url).toContain('/jobs/12345');
      expect(jobs[0].tags).toEqual(['JavaScript', 'React']);

      expect(jobs[1].title).toBe('Product Manager');
      expect(jobs[1].company).toBe('Startup Inc');
      expect(jobs[1].location).toBe('San Francisco');
    });

    it('should handle empty HTML', () => {
      const jobs = parseWellfoundHtml('<html><body></body></html>');
      expect(jobs.length).toBe(0);
    });

    it('should deduplicate jobs by URL', () => {
      const mockHtml = `
        <html>
          <body>
            <a href="/jobs/12345">
              <div data-test="job-title">Job 1</div>
            </a>
            <a href="/jobs/12345">
              <div data-test="job-title">Job 1 Duplicate</div>
            </a>
            <a href="/jobs/67890">
              <div data-test="job-title">Job 2</div>
            </a>
          </body>
        </html>
      `;

      const jobs = parseWellfoundHtml(mockHtml);
      expect(jobs.length).toBe(2);
    });

    it('should add full URL if href is relative', () => {
      const mockHtml = `
        <html>
          <body>
            <a href="/jobs/12345">
              <div data-test="job-title">Test Job</div>
            </a>
          </body>
        </html>
      `;

      const jobs = parseWellfoundHtml(mockHtml);
      expect(jobs[0].url).toBe('https://wellfound.com/jobs/12345');
    });
  });
});
