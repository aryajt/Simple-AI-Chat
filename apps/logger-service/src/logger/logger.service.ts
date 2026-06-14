import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { LogPayload } from '@app/shared';

@Injectable()
export class LoggerService {
  private readonly logDir = process.env.LOG_DIR ?? '/app/logs';

  constructor() {
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  save(payload: LogPayload): void {
    const line = JSON.stringify(payload) + '\n';

    // Print to stdout so `docker logs` shows it too
    const prefix = `[${payload.timestamp}] [${payload.service}] [${payload.level.toUpperCase()}]`;
    const ctx = payload.context ? ` [${payload.context}]` : '';
    console.log(`${prefix}${ctx} ${payload.message}`);

    // Append to daily log file: logs/2026-06-14.log
    const date = payload.timestamp.slice(0, 10);
    const filePath = path.join(this.logDir, `${date}.log`);
    fs.appendFile(filePath, line, (err) => {
      if (err) console.error('Logger: failed to write log file', err);
    });
  }
}
