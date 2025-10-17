// src/modules/files/resume.service.ts
import { Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  async extractText(buffer: Buffer, mimetype: string): Promise<string> {
    try {
      // PDF
      if (mimetype === 'application/pdf') {
        // pdf-parse has different export shapes depending on bundler/tsconfig.
        // Normalize to a callable function:
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const pdf = (pdfParse as any).default ?? (pdfParse as any);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const data = await pdf(buffer);
        return (data?.text || '').trim();
      }

      // DOCX / Word
      if (
        mimetype ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype === 'application/msword'
      ) {
        const res = await mammoth.extractRawText({ buffer });
        return (res?.value || '').trim();
      }

      // Plain text
      if (mimetype.startsWith('text/')) {
        return buffer.toString('utf8');
      }

      // Unknown type -> return empty string (or extend with textract if needed)
      return '';
    } catch (err) {
      this.logger.warn('Resume extraction error', err);
      return '';
    }
  }
}
