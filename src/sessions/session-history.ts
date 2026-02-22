import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { SessionExchange } from './types.js';

const SESSIONS_DIR = '.dexter/sessions/cli';
const HISTORY_FILE = 'history.jsonl';

export class SessionHistory {
  private readonly filepath: string;

  constructor(sessionId: string, baseDir: string = process.cwd()) {
    this.filepath = join(baseDir, SESSIONS_DIR, sessionId, HISTORY_FILE);
  }

  append(exchange: SessionExchange): void {
    const dir = dirname(this.filepath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    appendFileSync(this.filepath, JSON.stringify(exchange) + '\n');
  }

  load(): SessionExchange[] {
    if (!existsSync(this.filepath)) {
      return [];
    }

    return readFileSync(this.filepath, 'utf-8')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => this.parseLine(line))
      .filter((entry): entry is SessionExchange => entry !== null);
  }

  private parseLine(line: string): SessionExchange | null {
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object' && 'id' in parsed && 'query' in parsed) {
        return parsed as SessionExchange;
      }
      return null;
    } catch {
      return null;
    }
  }
}
