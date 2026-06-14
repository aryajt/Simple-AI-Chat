import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Message } from './entities/message.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { CreateMessageDto, MessageDto, MessageRole, NATS_SUBJECTS, AiRequestPayload } from '@app/shared';
import { EventsService } from '../events/events.service';

export const NATS_CLIENT = 'NATS_CLIENT';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @Optional() @Inject(NATS_CLIENT)
    private readonly natsClient: ClientProxy | null,
    private readonly eventsService: EventsService,
  ) {}

  async getHistory(conversationId: string): Promise<MessageDto[]> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }
    const messages = await this.messageRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
    return messages.map(this.toDto);
  }

  async createUserMessage(
    conversationId: string,
    dto: CreateMessageDto,
  ): Promise<MessageDto> {
    if (!dto.content || dto.content.trim().length === 0) {
      throw new BadRequestException('Content must not be empty');
    }
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }
    const message = this.messageRepo.create({
      conversationId,
      role: MessageRole.USER,
      content: dto.content,
    });
    const saved = await this.messageRepo.save(message);

    // If this is the first message in the conversation, use it as the title
    const messageCount = await this.messageRepo.count({ where: { conversationId } });
    if (messageCount === 1) {
      const title = dto.content.trim().substring(0, 255);
      await this.conversationRepo.update({ id: conversationId }, { title });
    }

    // Pre-create the SSE subject so it exists before the AI responds,
    // preventing the race condition where the response arrives before
    // the frontend opens the SSE connection.
    this.eventsService.getOrCreate(conversationId);

    // Publish to NATS for AI processing
    if (this.natsClient) {
      const payload: AiRequestPayload = { conversationId, content: dto.content };
      this.natsClient.emit(NATS_SUBJECTS.AI_REQUEST, payload);
    }

    return this.toDto(saved);
  }

  async createAssistantMessage(
    conversationId: string,
    content: string,
  ): Promise<MessageDto> {
    const message = this.messageRepo.create({
      conversationId,
      role: MessageRole.ASSISTANT,
      content,
    });
    const saved = await this.messageRepo.save(message);
    return this.toDto(saved);
  }

  private toDto(message: Message): MessageDto {
    const dto = new MessageDto();
    dto.id = message.id;
    dto.conversationId = message.conversationId;
    dto.role = message.role;
    dto.content = message.content;
    dto.createdAt = message.createdAt.toISOString();
    return dto;
  }
}
