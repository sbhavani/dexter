/**
 * Terminal detection utilities for streaming mode.
 */

// Module-level override that can be set by CLI flags
let streamingOverride: boolean | null = null;

export interface TerminalCapability {
  /** Whether terminal supports streaming */
  canStream: boolean;
  /** Whether terminal supports ANSI colors */
  supportsColor: boolean;
  /** Whether terminal supports cursor control */
  supportsCursorControl: boolean;
}

/**
 * Detect if streaming should be enabled based on terminal capabilities.
 *
 * Streaming is disabled when:
 * - Output is not to a TTY (piped/redirected)
 * - NO_COLOR environment variable is set
 * - FORCE_NO_STREAM environment variable is set
 *
 * Streaming can be forced with FORCE_STREAM=1
 */
export function detectTerminalCapability(): TerminalCapability {
  const isTTY = process.stdout.isTTY === true;
  const noColor = process.env.NO_COLOR !== undefined;
  const forceNoStream = process.env.FORCE_NO_STREAM !== undefined;
  const forceStream = process.env.FORCE_STREAM === '1';

  // Determine if streaming is supported
  let canStream: boolean;
  if (forceStream) {
    canStream = true;
  } else if (forceNoStream) {
    canStream = false;
  } else {
    canStream = isTTY;
  }

  // Determine color support
  let supportsColor: boolean;
  if (noColor) {
    supportsColor = false;
  } else if (forceStream || forceNoStream) {
    // When forcing stream, also enable colors by default
    supportsColor = !noColor;
  } else {
    supportsColor = isTTY;
  }

  // Cursor control requires TTY
  const supportsCursorControl = isTTY && supportsColor;

  return {
    canStream,
    supportsColor,
    supportsCursorControl,
  };
}

/**
 * Check if streaming is enabled based on terminal detection
 *
 * If a CLI override has been set (via setStreamingOverride), it takes precedence.
 * Otherwise, uses automatic terminal detection.
 */
export function isStreamingEnabled(): boolean {
  // CLI override takes precedence
  if (streamingOverride !== null) {
    return streamingOverride;
  }
  // Check for environment variable override
  if (process.env.DEXTER_STREAM !== undefined) {
    return process.env.DEXTER_STREAM === 'true';
  }
  return detectTerminalCapability().canStream;
}

/**
 * Set streaming override from CLI flags.
 * Once set, this takes precedence over automatic detection.
 *
 * @param enabled - true for --stream, false for --no-stream
 */
export function setStreamingOverride(enabled: boolean): void {
  streamingOverride = enabled;
}

/**
 * Get the current streaming override value (for testing/debugging)
 */
export function getStreamingOverride(): boolean | null {
  return streamingOverride;
}

/**
 * Check if colors should be used
 */
export function isColorEnabled(): boolean {
  return detectTerminalCapability().supportsColor;
}
