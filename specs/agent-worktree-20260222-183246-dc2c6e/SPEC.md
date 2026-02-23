# Feature Specification: Session Persistence

## 1. Overview

Implement session persistence for the Dexter CLI to allow saving conversation history to disk and resuming previous sessions via a `--session <id>` flag.

## 2. User Experience

### 2.1 Normal Launch (New Session)
```bash
bun run src/index.tsx
```
- Creates a new session with a unique ID
- Shows welcome/intro screen

### 2.2 Resume Previous Session
```bash
bun run src/index.tsx --session <session-id>
```
- Loads the specified session from disk
- Restores conversation history in the UI and LLM context

### 2.3 List Sessions
```bash
bun run src/index.tsx --list-sessions
```
- Lists all saved sessions with their IDs, timestamps, and message counts

## 3. Technical Design

### 3.1 Storage Location
Sessions stored in `.dexter/sessions/{session-id}/session.json`

### 3.2 Session Data Structure
```typescript
interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  provider: string;
  messages: SessionMessage[];
  approvedTools: string[];
}

interface SessionMessage {
  id: number;
  query: string;
  answer: string | null;
  summary: string | null;
}
```

### 3.3 New Files
- `src/utils/session-store.ts` - Session persistence logic
- `src/utils/cli-args.ts` - CLI argument parsing

### 3.4 Modified Files
- `src/index.tsx` - Parse CLI args before running CLI
- `src/cli.ts` - Accept session ID parameter, load session on startup
- `src/controllers/model-selection.ts` - Add method to get/set model info for session
- `src/controllers/agent-runner.ts` - Add method to restore history from session

### 3.5 Session Management Flow

1. **New session**: Generate unique ID, create empty session file
2. **Save on query**: After each agent completes, save current state to session file
3. **Resume session**: Load session JSON, populate `InMemoryChatHistory` and UI history
4. **List sessions**: Read all session directories, display metadata

### 3.6 Key Implementation Details

- Session ID format: `YYYYMMDD-HHMMSS` (timestamp-based, human-readable)
- Auto-save: After each query completes, persist session state
- Approved tools: Persist session-approved tools for convenience
- Model/provider: Store current model configuration in session

## 4. Acceptance Criteria

1. Running `bun run src/index.tsx` creates a new session
2. Running `bun run src/index.tsx --session <id>` resumes the specified session
3. Running `bun run src/index.tsx --list-sessions` shows all saved sessions
4. Conversation history persists across CLI restarts
5. LLM context (relevant message selection) works with restored history
6. Session metadata (model, provider, timestamps) is preserved
7. Invalid session ID shows clear error message
