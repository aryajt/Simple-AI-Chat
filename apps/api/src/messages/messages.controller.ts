import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto, MessageDto } from '@app/shared';

@Controller('conversations/:id/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getHistory(@Param('id') conversationId: string): Promise<MessageDto[]> {
    return this.messagesService.getHistory(conversationId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Param('id') conversationId: string,
    @Body() dto: CreateMessageDto,
  ): Promise<MessageDto> {
    return this.messagesService.createUserMessage(conversationId, dto);
  }
}
