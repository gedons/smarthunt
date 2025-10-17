// src/modules/files/resume.service.ts
import { Injectable, Logger } from '@nestjs/common';
import mammoth from 'mammoth';

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  async extractText(buffer: Buffer, mimetype: string): Promise<string> {
    try {
      // PDF
      if (mimetype === 'application/pdf') {
        try {
          const pdfParse = require('pdf-parse');
          const data = await pdfParse(buffer);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const text = (data?.text || '').trim();
          return text;
        } catch (pdfErr) {
          this.logger.error('pdf-parse failed:', pdfErr);
          return '';
        }
      }

      // DOCX / Word (.docx)
      if (
        mimetype ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype === 'application/msword'
      ) {
        try {
          const res = await mammoth.extractRawText({ buffer });
          const text = (res?.value || '').trim();
          return text;
        } catch (mErr) {
          this.logger.error('mammoth failed:', mErr);
          return '';
        }
      }

      // Plain text
      if (mimetype && mimetype.startsWith('text/')) {
        const text = buffer.toString('utf8').trim();
        return text;
      }

      this.logger.warn(`Unsupported mimetype for extraction: ${mimetype}`);
      return '';
    } catch (err) {
      this.logger.error('Resume extraction error:', err);
      return '';
    }
  }
}