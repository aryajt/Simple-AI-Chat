import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { LoggerService } from './logger.service';
import { LogPayload, NATS_SUBJECTS } from '@app/shared';

@Controller()
export class LoggerController {
  constructor(private readonly loggerService: LoggerService) {}

  @EventPattern(NATS_SUBJECTS.LOG)
  handleLog(@Payload() payload: LogPayload): void {
    this.loggerService.save(payload);
  }
}
