import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Message } from './entities/message.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { NATS_CLIENT } from './messages.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Conversation]),
    ClientsModule.register([
      {
        name: NATS_CLIENT,
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
        },
      },
    ]),
    EventsModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService, ClientsModule],
})
export class MessagesModule {}
