import { Writable } from 'node:stream';
import type { StreamingConfig, StreamType } from './types.js';
import { DEFAULT_STREAMING_CONFIG } from './types.js';
import { detectTerminalCapability } from './terminal-detection.js';

/**
 * Manages the flow of tokens from various sources to the terminal output.
 */
export class StreamController {
  private buffer: string[] = [];
  private config: StreamingConfig;
  private outputTarget: Writable;
  private enabled: boolean = false;
  private useColor: boolean = false;

  constructor(outputTarget: Writable = process.stdout, config: Partial<StreamingConfig> = {}) {
    this.outputTarget = outputTarget;
    this.config = { ...DEFAULT_STREAMING_CONFIG, ...config };

    // Auto-detect terminal capabilities
    const capability = detectTerminalCapability();
    this.enabled = this.config.enabled && capability.canStream;
    this.useColor = capability.supportsColor && this.enabled;
  }

  /**
   * Check if streaming is currently active
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check if color output is enabled
   */
  isColorEnabled(): boolean {
    return this.useColor;
  }

  /**
   * Get the buffer size
   */
  getBufferSize(): number {
    return this.config.bufferSize;
  }

  /**
   * Write a chunk to the thinking stream
   */
  writeThinking(delta: string): void {
    this.write(delta, 'thinking');
  }

  /**
   * Write a chunk to the tool result stream
   */
  writeToolResult(toolId: string, delta: string): void {
    this.write(delta, 'tool');
  }

  /**
   * Write a chunk to the answer stream
   */
  writeAnswer(delta: string): void {
    this.write(delta, 'answer');
  }

  /**
   * Internal write method with buffering
   */
  private write(delta: string, type: StreamType): void {
    if (!delta) {
      return;
    }

    // Graceful degradation: when streaming is disabled, write directly
    if (!this.enabled) {
      this.outputTarget.write(delta);
      return;
    }

    this.buffer.push(delta);

    // Flush when buffer reaches threshold
    if (this.buffer.length >= this.config.bufferSize) {
      this.flush(type);
    }
  }

  /**
   * Flush the buffer to output
   */
  flush(type?: StreamType): void {
    if (this.buffer.length === 0) {
      return;
    }

    const content = this.buffer.join('');
    this.buffer = [];

    // Graceful degradation: always output content even when streaming is disabled
    this.outputTarget.write(content);
  }

  /**
   * Force flush all pending content
   */
  flushAll(): void {
    if (this.buffer.length > 0) {
      const content = this.buffer.join('');
      this.buffer = [];
      // Graceful degradation: always output content even when streaming is disabled
      this.outputTarget.write(content);
    }
  }

  /**
   * Write a line with newline
   */
  writeLine(content: string): void {
    this.flushAll();
    // Graceful degradation: always output content even when streaming is disabled
    this.outputTarget.write(content + '\n');
  }

  /**
   * Clear current line (for cursor control)
   */
  clearLine(): void {
    if (!this.enabled || !this.useColor) {
      return;
    }
    // ANSI escape: Clear line from cursor to end
    this.outputTarget.write('\x1b[K');
  }

  /**
   * Move cursor up n lines
   */
  moveUp(lines: number = 1): void {
    if (!this.enabled || !this.useColor) {
      return;
    }
    // ANSI escape: Move cursor up n lines
    this.outputTarget.write(`\x1b[${lines}A`);
  }

  /**
   * Carriage return (move to beginning of line)
   */
  carriageReturn(): void {
    if (!this.enabled) {
      return;
    }
    this.outputTarget.write('\r');
  }

  /**
   * Reset streaming configuration
   */
  setConfig(config: Partial<StreamingConfig>): void {
    this.config = { ...this.config, ...config };
    const capability = detectTerminalCapability();
    this.enabled = this.config.enabled && capability.canStream;
    this.useColor = capability.supportsColor && this.enabled;
  }

  /**
   * Enable or disable streaming
   */
  setEnabled(enabled: boolean): void {
    this.flushAll();
    this.enabled = enabled && detectTerminalCapability().canStream;
    this.useColor = enabled && detectTerminalCapability().supportsColor;
  }
}

/**
 * Global stream controller instance
 */
let globalController: StreamController | null = null;

/**
 * Get or create the global stream controller
 */
export function getStreamController(outputTarget?: Writable): StreamController {
  if (!globalController) {
    globalController = new StreamController(outputTarget);
  }
  return globalController;
}

/**
 * Reset the global stream controller
 */
export function resetStreamController(): void {
  globalController = null;
}
