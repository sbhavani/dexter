import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { generateSessionId } from './id.js';
import { SessionStore } from './session-store.js';
import { SessionHistory } from './session-history.js';
import type { SessionMetadata, SessionExchange } from './types.js';
import type { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

export class SessionManager {
  private readonly store: SessionStore;
  private readonly baseDir: string;
  private history: SessionHistory | null = null;
  private currentSessionId: string | null = null;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
    this.store = new SessionStore(baseDir);
  }

  startNew(model: string, provider: string): SessionMetadata {
    const id = generateSessionId();
    const now = Date.now();
    const metadata: SessionMetadata = {
      id,
      createdAt: now,
      updatedAt: now,
      exchangeCount: 0,
      model,
      provider,
      firstQuery: '',
      lastQuery: '',
    };
    this.store.create(metadata);
    this.history = new SessionHistory(id, this.baseDir);
    this.currentSessionId = id;
    return metadata;
  }

  resume(
    id: string,
    inMemoryChatHistory: InMemoryChatHistory,
  ): { metadata: SessionMetadata; exchanges: SessionExchange[] } {
    const metadata = this.store.get(id);
    if (!metadata) {
      throw new Error(`Session "${id}" not found.`);
    }

    this.history = new SessionHistory(id, this.baseDir);
    this.currentSessionId = id;
    const exchanges = this.history.load();

    // Replay completed exchanges into InMemoryChatHistory
    for (const exchange of exchanges) {
      if (exchange.status === 'complete') {
        inMemoryChatHistory.saveUserQuery(exchange.query);
        // Access the messages array to set answer and summary directly
        const messages = inMemoryChatHistory.getMessages();
        const lastMsg = messages[messages.length - 1];
        if (lastMsg) {
          lastMsg.answer = exchange.answer;
          lastMsg.summary = exchange.summary;
        }
      }
    }

    return { metadata, exchanges };
  }

  saveExchange(exchange: {
    query: string;
    answer: string;
    summary: string | null;
    model: string;
    status: 'complete' | 'error' | 'interrupted';
    duration: number | null;
    tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
  }): void {
    if (!this.history || !this.currentSessionId) return;

    const sessionExchange: SessionExchange = {
      id: String(Date.now()),
      timestamp: Date.now(),
      ...exchange,
    };

    this.history.append(sessionExchange);

    const isComplete = exchange.status === 'complete';
    const meta = this.store.get(this.currentSessionId);
    if (meta) {
      const updates: Partial<SessionMetadata> = {
        updatedAt: Date.now(),
        lastQuery: truncate(exchange.query, 100),
      };
      if (isComplete) {
        updates.exchangeCount = meta.exchangeCount + 1;
      }
      if (!meta.firstQuery) {
        updates.firstQuery = truncate(exchange.query, 100);
      }
      this.store.update(this.currentSessionId, updates);
    }
  }

  listSessions(): SessionMetadata[] {
    return this.store.list();
  }

  deleteSession(id: string): boolean {
    const deleted = this.store.delete(id);
    if (deleted) {
      const sessionDir = join(this.baseDir, '.dexter', 'sessions', 'cli', id);
      try {
        rmSync(sessionDir, { recursive: true, force: true });
      } catch {
        // Directory may not exist if no exchanges were saved
      }
    }
    return deleted;
  }

  getSessionId(): string | null {
    return this.currentSessionId;
  }
}
