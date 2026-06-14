import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { connect, NatsConnection, Subscription, JSONCodec } from 'nats';
import { MessagesService } from '../messages/messages.service';
import { EventsService } from '../events/events.service';
import { AiResponsePayload, NATS_SUBJECTS } from '@app/shared';

// NestJS ClientProxy wraps every emitted message in this envelope:
// { pattern: string, data: T }
interface NatsEnvelope<T> {
  pattern: string;
  data: T;
}

@Injectable()
export class NatsSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsSubscriberService.name);
  private nc: NatsConnection | null = null;
  private subscription: Subscription | null = null;
  private readonly pendingTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly jc = JSONCodec<NatsEnvelope<AiResponsePayload>>();

  constructor(
    private readonly messagesService: MessagesService,
    private readonly eventsService: EventsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const natsUrl = process.env.NATS_URL ?? 'nats://localhost:4222';
    let retries = 0;
    while (!this.nc) {
      try {
        this.nc = await connect({ servers: natsUrl });
      } catch (err) {
        retries++;
        this.logger.error(
          `NATS connection failed (attempt ${retries}): ${(err as Error).message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    this.subscription = this.nc.subscribe(NATS_SUBJECTS.AI_RESPONSE);
    this.processMessages();
  }

  private async processMessages(): Promise<void> {
    if (!this.subscription) return;
    for await (const msg of this.subscription) {
      try {
        const envelope = this.jc.decode(msg.data);
        // NestJS ClientProxy wraps payload as { pattern, data }
        // Fall back to treating the whole envelope as the payload for safety
        const payload: AiResponsePayload =
          envelope && typeof envelope === 'object' && 'data' in envelope
            ? envelope.data
            : (envelope as unknown as AiResponsePayload);

        await this.handleAiResponse(payload);
      } catch (err) {
        this.logger.warn('Failed to process ai.response message', err);
      }
    }
  }

  async handleAiResponse(payload: AiResponsePayload): Promise<void> {
    const { conversationId, content } = payload;

    if (!conversationId) {
      this.logger.error('Received ai.response with missing conversationId', payload);
      return;
    }

    this.clearConversationTimeout(conversationId);
    try {
      const message = await this.messagesService.createAssistantMessage(
        conversationId,
        content,
      );
      this.eventsService.emit(conversationId, message);
    } catch (err) {
      this.logger.error(
        `Failed to handle AI response for conversation ${conversationId}`,
        err,
      );
    }
  }

  startTimeout(conversationId: string): void {
    this.clearConversationTimeout(conversationId);
    const timeout = setTimeout(async () => {
      this.logger.warn(`AI service timed out for conversation ${conversationId}`);
      this.pendingTimeouts.delete(conversationId);
      try {
        const timeoutMessage = await this.messagesService.createAssistantMessage(
          conversationId,
          '[AI service timed out]',
        );
        this.eventsService.emit(conversationId, timeoutMessage);
      } catch (err) {
        this.logger.error(
          `Failed to persist timeout message for ${conversationId}`,
          err,
        );
      }
    }, 30_000);
    this.pendingTimeouts.set(conversationId, timeout);
  }

  private clearConversationTimeout(conversationId: string): void {
    const existing = this.pendingTimeouts.get(conversationId);
    if (existing) {
      clearTimeout(existing);
      this.pendingTimeouts.delete(conversationId);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.subscription?.unsubscribe();
    await this.nc?.close();
  }
}
