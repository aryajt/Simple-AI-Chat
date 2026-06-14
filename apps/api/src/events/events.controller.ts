import {
  Controller,
  Param,
  Sse,
  Res,
  MessageEvent,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Response } from 'express';
import { EventsService } from './events.service';
import { MessageDto } from '@app/shared';

@Controller('conversations')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Sse(':id/events')
  streamEvents(
    @Param('id') conversationId: string,
    @Res() res: Response,
  ): Observable<MessageEvent> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    // getOrCreate ensures that if MessagesService already pre-created the subject
    // (before SSE connected), we reuse it and receive buffered messages.
    const subject = this.eventsService.getOrCreate(conversationId);

    res.on('close', () => {
      this.eventsService.cleanup(conversationId);
    });

    return subject.asObservable().pipe(
      map((message: MessageDto): MessageEvent => ({
        data: message,
      })),
    );
  }
}
