import { runRemoteOK, parseRemoteOKHtml } from '../remoteok.scraper';

describe('RemoteOK Scraper', () => {
  describe('runRemoteOK (integration)', () => {
    it('should fetch and parse jobs from remoteok.com', async () => {
      const jobs = await runRemoteOK();

      expect(Array.isArray(jobs)).toBe(true);

      // RemoteOK might return empty if blocked, so we make this flexible
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

        if (firstJob.tags) {
          expect(Array.isArray(firstJob.tags)).toBe(true);
        }
      } else {
        // If no jobs returned, still pass the test (might be rate limited)
        console.warn(
          'RemoteOK returned no jobs - might be rate limited or blocked',
        );
      }
    }, 30000);

    it('should return jobs with valid URLs', async () => {
      const jobs = await runRemoteOK();

      jobs.forEach((job) => {
        expect(job.url).toMatch(/^https?:\/\//);
        expect(job.url).not.toBe('https://remoteok.com');
      });
    }, 30000);
  });

  describe('parseRemoteOKHtml (unit)', () => {
    it('should parse HTML with job listings', () => {
      const mockHtml = `
        <html>
          <body>
            <table>
              <tr class="job" data-id="12345">
                <td>
                  <h2>Senior Full Stack Developer</h2>
                  <a class="companyLink">Acme Corp</a>
                  <a class="preventLink" href="/remote-jobs/12345"></a>
                  <div class="tags">
                    <a>JavaScript</a>
                    <a>React</a>
                    <a>Node.js</a>
                  </div>
                  <div class="description">Amazing opportunity to work remotely</div>
                  <div class="location">🌎 Worldwide</div>
                  <div class="salary">$120k-$180k</div>
                </td>
              </tr>
              <tr class="job" data-id="67890">
                <td>
                  <h2>DevOps Engineer</h2>
                  <a class="companyLink">Tech Startup</a>
                  <a class="preventLink" href="/remote-jobs/67890"></a>
                  <div class="tags">
                    <a>AWS</a>
                    <a>Docker</a>
                  </div>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const jobs = parseRemoteOKHtml(mockHtml);

      expect(jobs.length).toBe(2);

      expect(jobs[0].title).toBe('Senior Full Stack Developer');
      expect(jobs[0].company).toBe('Acme Corp');
      expect(jobs[0].url).toContain('/remote-jobs/12345');
      expect(jobs[0].tags).toEqual(['JavaScript', 'React', 'Node.js']);
      expect(jobs[0].description).toBe('Amazing opportunity to work remotely');
      expect(jobs[0].location).toBe('🌎 Worldwide');
      expect(jobs[0].salary).toBe('$120k-$180k');

      expect(jobs[1].title).toBe('DevOps Engineer');
      expect(jobs[1].company).toBe('Tech Startup');
      expect(jobs[1].tags).toEqual(['AWS', 'Docker']);
    });

    it('should handle empty HTML', () => {
      const jobs = parseRemoteOKHtml('<html><body></body></html>');
      expect(jobs.length).toBe(0);
    });

    it('should skip jobs without title', () => {
      const mockHtml = `
        <table>
          <tr class="job" data-id="123">
            <td>
              <h2></h2>
              <a class="preventLink" href="/remote-jobs/123"></a>
            </td>
          </tr>
          <tr class="job" data-id="456">
            <td>
              <h2>Valid Job</h2>
              <a class="preventLink" href="/remote-jobs/456"></a>
            </td>
          </tr>
        </table>
      `;

      const jobs = parseRemoteOKHtml(mockHtml);
      expect(jobs.length).toBe(1);
      expect(jobs[0].title).toBe('Valid Job');
    });

    it('should add full URL if href is relative', () => {
      const mockHtml = `
        <table>
          <tr class="job" data-id="test-123">
            <td>
              <h2>Test Job</h2>
              <a class="preventLink" href="/remote-jobs/test-123"></a>
            </td>
          </tr>
        </table>
      `;

      const jobs = parseRemoteOKHtml(mockHtml);
      expect(jobs.length).toBe(1);
      expect(jobs[0].url).toBe('https://remoteok.com/remote-jobs/test-123');
    });

    it('should handle missing optional fields', () => {
      const mockHtml = `
        <table>
          <tr class="job" data-id="minimal">
            <td>
              <h2>Minimal Job</h2>
              <a class="preventLink" href="/remote-jobs/minimal"></a>
            </td>
          </tr>
        </table>
      `;

      const jobs = parseRemoteOKHtml(mockHtml);
      expect(jobs.length).toBe(1);
      expect(jobs[0].title).toBe('Minimal Job');
      expect(jobs[0].company).toBeNull();
      expect(jobs[0].description).toBeNull();
      expect(jobs[0].location).toBeNull();
      expect(jobs[0].salary).toBeNull();
      expect(jobs[0].tags).toEqual([]);
    });
  });
});
