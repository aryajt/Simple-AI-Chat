import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AiRequestPayload, AiResponsePayload, NATS_SUBJECTS } from '@app/shared';
import { generateMockResponse } from '../mock-response/mock-response.generator';

export const NATS_CLIENT = 'NATS_CLIENT';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(NATS_CLIENT)
    private readonly natsClient: ClientProxy,
  ) {}

  handleRequest(payload: AiRequestPayload): void {
    const responseContent = generateMockResponse(payload.content);
    const response: AiResponsePayload = {
      conversationId: payload.conversationId,
      content: responseContent,
    };
        this.logger.debug(
      `User Message: ${payload.content}`,
    );
    this.logger.debug(
      `Sending AI response for conversation: ${payload.conversationId}`,
    );
    this.logger.debug(
      `Response for user: ${response.content}`,
    );
    this.natsClient.emit(NATS_SUBJECTS.AI_RESPONSE, response);
  }
}
