import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { SessionIndex, SessionMetadata } from './types.js';

const SESSIONS_DIR = '.dexter/sessions';
const INDEX_FILE = 'index.json';

function emptyIndex(): SessionIndex {
  return { version: 1, sessions: {} };
}

export class SessionStore {
  private readonly indexPath: string;

  constructor(baseDir: string = process.cwd()) {
    this.indexPath = join(baseDir, SESSIONS_DIR, INDEX_FILE);
  }

  load(): SessionIndex {
    if (!existsSync(this.indexPath)) {
      return emptyIndex();
    }
    try {
      const content = readFileSync(this.indexPath, 'utf-8');
      const data = JSON.parse(content) as SessionIndex;
      return data;
    } catch {
      return emptyIndex();
    }
  }

  save(index: SessionIndex): void {
    const dir = dirname(this.indexPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  create(metadata: SessionMetadata): void {
    const index = this.load();
    index.sessions[metadata.id] = metadata;
    this.save(index);
  }

  get(id: string): SessionMetadata | null {
    const index = this.load();
    return index.sessions[id] ?? null;
  }

  list(): SessionMetadata[] {
    const index = this.load();
    return Object.values(index.sessions).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  update(id: string, partial: Partial<SessionMetadata>): void {
    const index = this.load();
    const existing = index.sessions[id];
    if (!existing) return;
    index.sessions[id] = { ...existing, ...partial };
    this.save(index);
  }

  delete(id: string): boolean {
    const index = this.load();
    if (!index.sessions[id]) return false;
    delete index.sessions[id];
    this.save(index);
    return true;
  }
}
