// src/modules/files/resume.service.ts
import { Injectable, Logger } from '@nestjs/common';
import mammoth from 'mammoth';

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  // robust pdf parsing + docx + plain text. uses require() for pdf-parse to avoid import shape issues
  async extractText(buffer: Buffer, mimetype: string): Promise<string> {
    try {
      this.logger.log(`extractText called. mimetype=${mimetype} bytes=${buffer?.length}`);

      // PDF
      if (mimetype === 'application/pdf') {
        try {
          // require at runtime to avoid ESM/CJS export shape issues
          const pdfParse = require('pdf-parse');
          if (typeof pdfParse !== 'function' && pdfParse?.default) {
            // some builds export as { default: fn }
            const fn = pdfParse.default;
            if (typeof fn === 'function') {
              const data = await fn(buffer);
              const text = (data?.text || '').trim();
              this.logger.log(`PDF extracted text length=${text.length}`);
              return text;
            }
          }
          if (typeof pdfParse === 'function') {
            const data = await pdfParse(buffer);
            const text = (data?.text || '').trim();
            this.logger.log(`PDF extracted text length=${text.length}`);
            return text;
          }

          // fallback if shape unknown
          this.logger.warn(
            'pdf-parse import shape unknown; no callable function found.',
          );
          return '';
        } catch (pdfErr) {
          this.logger.warn('pdf-parse failed: ' + (pdfErr && pdfErr.message));
          return '';
        }
      }

      // DOCX / Word (.docx)
      if (
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype === 'application/msword'
      ) {
        try {
          const res = await mammoth.extractRawText({ buffer });
          const text = (res?.value || '').trim();
          this.logger.log(`DOCX extracted text length=${text.length}`);
          return text;
        } catch (mErr) {
          this.logger.warn('mammoth failed: ' + (mErr && mErr.message));
          return '';
        }
      }

      // Plain text
      if (mimetype && mimetype.startsWith('text/')) {
        const text = buffer.toString('utf8').trim();
        this.logger.log(`Plain-text extracted length=${text.length}`);
        return text;
      }

      this.logger.warn(`Unsupported mimetype for extraction: ${mimetype}`);
      return '';
    } catch (err) {
      this.logger.warn('Resume extraction error: ' + (err && (err as Error).message));
      return '';
    }
  }
}
