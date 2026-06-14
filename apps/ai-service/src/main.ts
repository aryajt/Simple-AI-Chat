import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport, ClientProxyFactory } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { NatsLoggerService } from '@app/shared';

async function bootstrap() {
  const natsUrl = process.env.NATS_URL ?? 'nats://localhost:4222';

  let loggerNatsClient: ReturnType<typeof ClientProxyFactory.create> | null = null;
  try {
    loggerNatsClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: { servers: [natsUrl] },
    });
    await loggerNatsClient.connect();
  } catch {
    loggerNatsClient = null;
  }

  const logger = new NatsLoggerService('ai-service', loggerNatsClient);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.NATS,
      options: { servers: [natsUrl] },
      logger,
    },
  );

  await app.listen();
  logger.log('AI service listening on NATS', 'Bootstrap');
}

bootstrap();
