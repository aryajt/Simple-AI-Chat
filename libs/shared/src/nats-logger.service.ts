import { LoggerService as NestLoggerService, Optional, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { LogPayload, LogLevel, NATS_SUBJECTS } from './index';

export const NATS_LOGGER_CLIENT = 'NATS_LOGGER_CLIENT';

export class NatsLoggerService implements NestLoggerService {
  constructor(
    private readonly serviceName: string,
    @Optional() @Inject(NATS_LOGGER_CLIENT)
    private readonly natsClient: ClientProxy | null,
  ) {}

  private publish(level: LogLevel, message: string, context?: string, meta?: Record<string, unknown>) {
    // Always print locally
    const ts = new Date().toISOString();
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
      `[${ts}] [${this.serviceName}] [${level.toUpperCase()}]${context ? ' [' + context + ']' : ''} ${message}`,
    );

    if (!this.natsClient) return;

    const payload: LogPayload = {
      service: this.serviceName,
      level,
      message: String(message),
      context,
      timestamp: ts,
      meta,
    };

    try {
      this.natsClient.emit(NATS_SUBJECTS.LOG, payload);
    } catch {
      // never crash the app just because logging failed
    }
  }

  log(message: unknown, context?: string)     { this.publish('log',     String(message), context); }
  warn(message: unknown, context?: string)    { this.publish('warn',    String(message), context); }
  error(message: unknown, trace?: string, context?: string) {
    this.publish('error', String(message), context, trace ? { trace } : undefined);
  }
  debug(message: unknown, context?: string)   { this.publish('debug',   String(message), context); }
  verbose(message: unknown, context?: string) { this.publish('verbose', String(message), context); }
}
