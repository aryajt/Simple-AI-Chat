import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AiService } from './ai.service';
import { AiRequestPayload, NATS_SUBJECTS } from '@app/shared';

@Controller()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @MessagePattern(NATS_SUBJECTS.AI_REQUEST)
  handleAiRequest(@Payload() payload: AiRequestPayload): void {
    if (!payload || !payload.conversationId || payload.content === undefined) {
      console.warn('AiController: received malformed ai.request payload', payload);
      return;
    }
    this.aiService.handleRequest(payload);
  }
}
