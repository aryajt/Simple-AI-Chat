import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { NatsLoggerService } from '@app/shared';

async function bootstrap() {
  const natsUrl = process.env.NATS_URL ?? 'nats://localhost:4222';

  // Create a NATS client just for logging (best-effort, won't crash if NATS is down)
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

  const logger = new NatsLoggerService('api', loggerNatsClient);

  const app = await NestFactory.create(AppModule, { logger });

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Cache-Control'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  const port = parseInt(process.env.API_PORT ?? '3000', 10);
  await app.listen(port);
  logger.log(`API running on port ${port}`, 'Bootstrap');
}

bootstrap();
