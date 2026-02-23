/**
 * Streaming configuration for terminal output.
 */
export interface StreamingConfig {
  /** Whether streaming is enabled */
  enabled: boolean;
  /** Buffer size for batching tokens (default: 10) */
  bufferSize: number;
  /** Whether to show thinking stream */
  showThinking: boolean;
  /** Whether to show tool progress stream */
  showToolProgress: boolean;
}

/**
 * Default streaming configuration
 */
export const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  enabled: true,
  bufferSize: 10,
  showThinking: true,
  showToolProgress: true,
};

/**
 * Stream type identifiers
 */
export type StreamType = 'thinking' | 'tool' | 'answer';

/**
 * Stream output options
 */
export interface StreamOutputOptions {
  /** Stream type for color coding */
  type: StreamType;
  /** Whether to use colors */
  useColor: boolean;
  /** Whether to flush immediately */
  flush?: boolean;
}
