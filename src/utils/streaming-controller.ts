import type { StreamingTokenType, TokenEvent, StreamingConfig } from '../agent/types.js';
import { DEFAULT_STREAMING_CONFIG } from '../agent/types.js';

/**
 * Runtime state for streaming pipeline
 */
export interface StreamingState {
  status: 'idle' | 'streaming' | 'paused';
  currentType: StreamingTokenType | null;
  lastFlush: number;
}

/**
 * Callback type for token events
 */
type TokenCallback = (event: TokenEvent) => void;

/**
 * StreamingController manages token buffering and emission for real-time streaming.
 * It accumulates tokens and flushes them at configured intervals to balance
 * responsiveness with I/O efficiency.
 */
export class StreamingController {
  private config: StreamingConfig;
  private state: StreamingState;
  private buffer: string;
  private flushTimer: ReturnType<typeof setTimeout> | null;
  private tokenCallback: TokenCallback | null;
  private abortController: AbortController | null;

  constructor(config: Partial<StreamingConfig> = {}, tokenCallback?: TokenCallback) {
    this.config = { ...DEFAULT_STREAMING_CONFIG, ...config };
    this.state = {
      status: 'idle',
      currentType: null,
      lastFlush: Date.now(),
    };
    this.buffer = '';
    this.flushTimer = null;
    this.tokenCallback = tokenCallback || null;
    this.abortController = null;
  }

  /**
   * Start streaming for a given token type
   */
  start(tokenType: StreamingTokenType): void {
    if (!this.config.enabled) return;

    // Flush any existing buffer before starting new stream
    this.flush();

    this.state.status = 'streaming';
    this.state.currentType = tokenType;
    this.state.lastFlush = Date.now();
    this.buffer = '';

    // Start flush timer
    this.startFlushTimer();
  }

  /**
   * Emit a token chunk
   */
  emit(content: string, isComplete: boolean = false): void {
    if (!this.config.enabled || this.state.status !== 'streaming') return;

    this.buffer += content;

    // Flush immediately if complete or buffer is large
    if (isComplete || this.buffer.length > 1024) {
      this.flush();
    }
  }

  /**
   * End streaming
   */
  end(): void {
    this.stopFlushTimer();
    this.flush(); // Flush any remaining content
    this.state.status = 'idle';
    this.state.currentType = null;
    this.buffer = '';
  }

  /**
   * Pause streaming (e.g., on interrupt)
   */
  pause(): void {
    if (this.state.status === 'streaming') {
      this.state.status = 'paused';
      this.stopFlushTimer();
      this.flush();
    }
  }

  /**
   * Resume streaming
   */
  resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'streaming';
      this.startFlushTimer();
    }
  }

  /**
   * Get current state
   */
  getState(): StreamingState {
    return { ...this.state };
  }

  /**
   * Check if streaming is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<StreamingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set abort signal for cancellation
   */
  setAbortSignal(signal: AbortSignal): void {
    this.abortController = new AbortController();

    signal.addEventListener('abort', () => {
      this.pause();
      this.end();
    });
  }

  /**
   * Flush buffer to callback
   */
  private flush(): void {
    if (!this.buffer || !this.tokenCallback || this.state.status !== 'streaming') {
      return;
    }

    const event: TokenEvent = {
      type: 'token',
      tokenType: this.state.currentType!,
      content: this.buffer,
      isComplete: false,
      timestamp: Date.now(),
    };

    this.tokenCallback(event);
    this.buffer = '';
    this.state.lastFlush = Date.now();
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    this.stopFlushTimer();

    const interval = this.config.bufferMs || 10;
    this.flushTimer = setTimeout(() => {
      if (this.state.status === 'streaming') {
        this.flush();
        this.startFlushTimer(); // Schedule next flush
      }
    }, interval);
  }

  /**
   * Stop the flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Mark streaming as complete (final chunk)
   */
  complete(): void {
    if (!this.config.enabled || !this.buffer) return;

    const event: TokenEvent = {
      type: 'token',
      tokenType: this.state.currentType!,
      content: this.buffer,
      isComplete: true,
      timestamp: Date.now(),
    };

    if (this.tokenCallback) {
      this.tokenCallback(event);
    }

    this.buffer = '';
    this.state.status = 'idle';
    this.state.currentType = null;
  }
}
