import { Injectable } from '@nestjs/common';
import { Subject, ReplaySubject } from 'rxjs';
import { MessageDto } from '@app/shared';

@Injectable()
export class EventsService {
  // Use ReplaySubject(1) so a late SSE subscriber gets the last message
  // even if it connects slightly after the AI response was emitted.
  private readonly subjects = new Map<string, ReplaySubject<MessageDto>>();

  getOrCreate(conversationId: string): ReplaySubject<MessageDto> {
    if (!this.subjects.has(conversationId)) {
      this.subjects.set(conversationId, new ReplaySubject<MessageDto>(5));
    }
    return this.subjects.get(conversationId)!;
  }

  emit(conversationId: string, message: MessageDto): void {
    // getOrCreate ensures we always have a subject to emit into
    this.getOrCreate(conversationId).next(message);
  }

  cleanup(conversationId: string): void {
    const subject = this.subjects.get(conversationId);
    if (subject) {
      subject.complete();
      this.subjects.delete(conversationId);
    }
  }
}
