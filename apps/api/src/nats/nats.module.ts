import { Module } from '@nestjs/common';
import { NatsSubscriberService } from './nats-subscriber.service';
import { MessagesModule } from '../messages/messages.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [MessagesModule, EventsModule],
  providers: [NatsSubscriberService],
  exports: [NatsSubscriberService],
})
export class NatsModule {}
