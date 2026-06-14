import { Injectable, ServiceUnavailableException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { CreateConversationDto, UpdateConversationDto, ConversationDto } from '@app/shared';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
  ) {}

  async create(dto: CreateConversationDto): Promise<ConversationDto> {
    try {
      const conversation = this.conversationRepo.create({
        title: dto.title || 'New Conversation',
      });
      const saved = await this.conversationRepo.save(conversation);
      return this.toDto(saved);
    } catch (error) {
      this.logger.error('Failed to create conversation', error);
      throw new ServiceUnavailableException('Database unavailable');
    }
  }

  async findAll(): Promise<ConversationDto[]> {
    try {
      const conversations = await this.conversationRepo.find({
        order: { createdAt: 'DESC' },
      });
      return conversations.map(this.toDto);
    } catch (error) {
      this.logger.error('Failed to fetch conversations', error);
      throw new ServiceUnavailableException('Database unavailable');
    }
  }

  async updateTitle(id: string, dto: UpdateConversationDto): Promise<ConversationDto> {
    const conversation = await this.conversationRepo.findOne({ where: { id } });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    conversation.title = dto.title.trim().substring(0, 255);
    const saved = await this.conversationRepo.save(conversation);
    return this.toDto(saved);
  }

  private toDto(conversation: Conversation): ConversationDto {
    const dto = new ConversationDto();
    dto.id = conversation.id;
    dto.title = conversation.title;
    dto.createdAt = conversation.createdAt.toISOString();
    return dto;
  }
}
