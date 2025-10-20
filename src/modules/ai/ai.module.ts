import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { EmbeddingsService } from './embeddings.service';
import { RecommendationService } from './recommendation.service';
import { DatabaseModule } from '../../modules/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [GeminiService, EmbeddingsService, RecommendationService],
  exports: [GeminiService, EmbeddingsService, RecommendationService],
})
export class AiModule {}
