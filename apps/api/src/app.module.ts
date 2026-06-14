import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { EventsModule } from './events/events.module';
import { NatsModule } from './nats/nats.module';

@Module({
  imports: [
    DatabaseModule,
    ConversationsModule,
    MessagesModule,
    EventsModule,
    NatsModule,
  ],
})
export class AppModule {}
