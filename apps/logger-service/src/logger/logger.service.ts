import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { LogPayload } from '@app/shared';

@Injectable()
export class LoggerService {
  // Default: write logs next to the logger-service source directory.
  // In Docker the LOG_DIR env var overrides this (set in docker-compose).
  private readonly logDir: string;

  constructor() {
    this.logDir = process.env.LOG_DIR
      ? path.resolve(process.env.LOG_DIR)
      : path.resolve(__dirname, '../../../../apps/logger-service/logs');

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    console.log(`[LoggerService] Writing logs to: ${this.logDir}`);
  }

  save(payload: LogPayload): void {
    const line = JSON.stringify(payload) + '\n';

    // Print to stdout so `docker logs` / terminal shows it
    const prefix = `[${payload.timestamp}] [${payload.service}] [${payload.level.toUpperCase()}]`;
    const ctx = payload.context ? ` [${payload.context}]` : '';
    console.log(`${prefix}${ctx} ${payload.message}`);

    // Append to daily log file: logs/2026-06-14.log
    const date = payload.timestamp.slice(0, 10);
    const filePath = path.join(this.logDir, `${date}.log`);
    fs.appendFile(filePath, line, (err) => {
      if (err) console.error('[LoggerService] Failed to write log file', err);
    });
  }
}
