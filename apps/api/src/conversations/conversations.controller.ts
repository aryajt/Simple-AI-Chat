import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto, UpdateConversationDto, ConversationDto } from '@app/shared';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateConversationDto): Promise<ConversationDto> {
    return this.conversationsService.create(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(): Promise<ConversationDto[]> {
    return this.conversationsService.findAll();
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateTitle(
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
  ): Promise<ConversationDto> {
    return this.conversationsService.updateTitle(id, dto);
  }
}
