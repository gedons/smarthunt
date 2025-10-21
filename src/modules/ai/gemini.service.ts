// src/modules/ai/gemini.service.ts
import { Injectable, Logger } from '@nestjs/common';
import fetch from 'node-fetch';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly key = process.env.GEMINI_API_KEY!;
  private readonly embedModel =
    process.env.GEMINI_EMBED_MODEL || 'models/gemini-embedding-001';
  private readonly embedUrl =
    process.env.GEMINI_EMBED_URL ||
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';
  private readonly batchEmbedUrl =
    process.env.GEMINI_EMBED_BATCH_URL ||
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents';
  private readonly genUrl =
    process.env.GEMINI_COMPLETION_URL ||
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  private readonly maxRetries = Number(process.env.GEMINI_MAX_RETRIES || 3);
  private readonly retryDelayMs = Number(
    process.env.GEMINI_RETRY_DELAY_MS || 500,
  );

  private headers() {
    if (!this.key) throw new Error('GEMINI_API_KEY not set');
    return {
      'Content-Type': 'application/json',
      'x-goog-api-key': this.key,
    };
  }

  // Single embed (string -> number[])
  async embed(text: string): Promise<number[]> {
    const payload = { content: { parts: [{ text }] } };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = await this.postWithRetry(this.embedUrl, payload);
    const emb =
      json?.embedding?.values ??
      json?.data?.[0]?.embedding?.values ??
      json?.data?.[0]?.embedding ??
      json?.embedding ??
      null;
    if (!emb) {
      this.logger.error(
        'No embedding found in response',
        JSON.stringify(json).slice(0, 400),
      );
      throw new Error('No embedding returned from Gemini');
    }
    return Array.isArray(emb) ? emb.map((v: any) => Number(v)) : [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!Array.isArray(texts) || texts.length === 0) return [];

    // Build correct Google Batch Embed payload: requests: [{ model, content }, ...]
    const requests = texts.map((text) => ({
      model: this.embedModel,
      content: { parts: [{ text }] },
    }));

    const payload = { requests };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = await this.postWithRetry(this.batchEmbedUrl, payload);

    if (json?.embeddings && Array.isArray(json.embeddings)) {
      return json.embeddings.map((e: any) => {
        const values = e?.values ?? e;
        return Array.isArray(values) ? values.map((x: any) => Number(x)) : [];
      });
    }

    if (json?.responses && Array.isArray(json.responses)) {
      return json.responses.map((r: any) => {
        const e = r.embedding?.values ?? r.embedding ?? r;
        return Array.isArray(e) ? e.map((x: any) => Number(x)) : [];
      });
    }

    this.logger.error(
      'Unrecognized batch embed response shape',
      JSON.stringify(json).slice(0, 400),
    );
    throw new Error('Unrecognized batch embed response');
  }

  // Generate text (completion)
  async generate(
    prompt: string,
    opts: { maxTokens?: number; temperature?: number } = {},
  ): Promise<string> {
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: opts.maxTokens ?? 2048,
        temperature: opts.temperature ?? 0.7,
        topP: 0.95,
        topK: 40,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_NONE',
        },
      ],
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = await this.postWithRetry(this.genUrl, payload);
    // Normalize output
    if (json?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return json.candidates[0].content.parts[0].text;
    }
    if (json?.candidates?.[0]?.text) return json.candidates[0].text;
    if (json?.text) return json.text;
    this.logger.error('No text in response', JSON.stringify(json).slice(0, 400));
    throw new Error('No text generated from Gemini');
  }

  // Helper: POST with retry/backoff
  private async postWithRetry(url: string, body: any): Promise<any> {
    let attempt = 0;
    while (attempt <= this.maxRetries) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) {
          const errMsg = JSON.stringify(json).slice(0, 800);
          throw new Error(
            `HTTP ${res.status} ${res.statusText}: ${errMsg}`,
          );
        }
        return json;
      } catch (err) {
        attempt++;
        this.logger.warn(
          `Gemini request failed (attempt ${attempt}): ${(err as Error).message}`,
        );
        if (attempt > this.maxRetries) {
          this.logger.error(
            'Gemini request failed (max retries reached)',
            (err as Error).stack,
          );
          throw err;
        }
        await sleep(this.retryDelayMs * attempt);
      }
    }
  }
}