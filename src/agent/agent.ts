import { AIMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { callLlm, callLlmStream } from '../model/llm.js';
import { getTools } from '../tools/registry.js';
import { buildSystemPrompt, buildIterationPrompt, buildFinalAnswerPrompt } from '../agent/prompts.js';
import { extractTextContent, hasToolCalls } from '../utils/ai-message.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import { estimateTokens, CONTEXT_THRESHOLD, KEEP_TOOL_USES } from '../utils/tokens.js';
import { isStreamingEnabled } from '../utils/env.js';
import type { AgentConfig, AgentEvent, ContextClearedEvent, TokenUsage, StreamingConfig } from '../agent/types.js';
import { DEFAULT_STREAMING_CONFIG } from '../agent/types.js';
import { createRunContext, type RunContext } from './run-context.js';
import { buildFinalAnswerContext } from './final-answer-context.js';
import { AgentToolExecutor } from './tool-executor.js';


const DEFAULT_MODEL = 'gpt-5.2';
const DEFAULT_MAX_ITERATIONS = 10;

/**
 * The core agent class that handles the agent loop and tool execution.
 */
export class Agent {
  private readonly model: string;
  private readonly maxIterations: number;
  private readonly tools: StructuredToolInterface[];
  private readonly toolMap: Map<string, StructuredToolInterface>;
  private readonly toolExecutor: AgentToolExecutor;
  private readonly systemPrompt: string;
  private readonly signal?: AbortSignal;
  private readonly streaming: StreamingConfig;

  private constructor(
    config: AgentConfig,
    tools: StructuredToolInterface[],
    systemPrompt: string
  ) {
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.tools = tools;
    this.toolMap = new Map(tools.map(t => [t.name, t]));
    this.toolExecutor = new AgentToolExecutor(this.toolMap, config.signal, config.requestToolApproval, config.sessionApprovedTools);
    this.systemPrompt = systemPrompt;
    this.signal = config.signal;
    // Default streaming config based on environment variable
    const streamingEnabled = isStreamingEnabled();
    this.streaming = config.streaming ?? {
      ...DEFAULT_STREAMING_CONFIG,
      enabled: streamingEnabled,
    };
  }

  /**
   * Create a new Agent instance with tools.
   */
  static create(config: AgentConfig = {}): Agent {
    const model = config.model ?? DEFAULT_MODEL;
    const tools = getTools(model);
    const systemPrompt = buildSystemPrompt(model);
    return new Agent(config, tools, systemPrompt);
  }

  /**
   * Run the agent and yield events for real-time UI updates.
   * Anthropic-style context management: full tool results during iteration,
   * with threshold-based clearing of oldest results when context exceeds limit.
   */
  async *run(query: string, inMemoryHistory?: InMemoryChatHistory): AsyncGenerator<AgentEvent> {
    const startTime = Date.now();
    const useStreaming = this.streaming.enabled;

    if (this.tools.length === 0) {
      yield { type: 'done', answer: 'No tools available. Please check your API key configuration.', toolCalls: [], iterations: 0, totalTime: Date.now() - startTime };
      return;
    }

    const ctx = createRunContext(query);

    // Build initial prompt with conversation history context
    let currentPrompt = this.buildInitialPrompt(query, inMemoryHistory);

    // Main agent loop
    while (ctx.iteration < this.maxIterations) {
      ctx.iteration++;

      let response: AIMessage | string;
      let usage: TokenUsage | undefined;

      if (useStreaming) {
        // For streaming, iterate through token events and collect the final result
        const result = await this.callModelStreaming(currentPrompt, ctx);
        response = result.response;
        usage = result.usage;
      } else {
        const result = await this.callModel(currentPrompt);
        response = result.response;
        usage = result.usage;
      }

      ctx.tokenCounter.add(usage);
      const responseText = typeof response === 'string' ? response : extractTextContent(response);

      // Emit thinking if there are also tool calls (skip whitespace-only responses)
      if (responseText?.trim() && typeof response !== 'string' && hasToolCalls(response)) {
        const trimmedText = responseText.trim();
        ctx.scratchpad.addThinking(trimmedText);
        yield { type: 'thinking', message: trimmedText };
      }

      // No tool calls = ready to generate final answer
      if (typeof response === 'string' || !hasToolCalls(response)) {
        // If no tools were called at all, just use the direct response
        // This handles greetings, clarifying questions, etc.
        if (!ctx.scratchpad.hasToolResults() && responseText) {
          yield* this.handleDirectResponse(responseText, ctx);
          return;
        }

        // Generate final answer with full context from scratchpad
        yield* this.generateFinalAnswer(ctx);
        return;
      }

      // Execute tools and add results to scratchpad (response is AIMessage here)
      for await (const event of this.toolExecutor.executeAll(response, ctx)) {
        yield event;
        if (event.type === 'tool_denied') {
          const totalTime = Date.now() - ctx.startTime;
          yield {
            type: 'done',
            answer: '',
            toolCalls: ctx.scratchpad.getToolCallRecords(),
            iterations: ctx.iteration,
            totalTime,
            tokenUsage: ctx.tokenCounter.getUsage(),
            tokensPerSecond: ctx.tokenCounter.getTokensPerSecond(totalTime),
          };
          return;
        }
      }
      yield* this.manageContextThreshold(ctx);

      // Build iteration prompt with full tool results (Anthropic-style)
      currentPrompt = buildIterationPrompt(
        query, 
        ctx.scratchpad.getToolResults(),
        ctx.scratchpad.formatToolUsageForPrompt()
      );
    }

    // Max iterations reached - still generate proper final answer
    yield* this.generateFinalAnswer(ctx, {
      fallbackMessage: `Reached maximum iterations (${this.maxIterations}).`,
    });
  }

  /**
   * Call the LLM with the current prompt.
   * @param prompt - The prompt to send to the LLM
   * @param useTools - Whether to bind tools (default: true). When false, returns string directly.
   */
  private async callModel(prompt: string, useTools: boolean = true): Promise<{ response: AIMessage | string; usage?: TokenUsage }> {
    const result = await callLlm(prompt, {
      model: this.model,
      systemPrompt: this.systemPrompt,
      tools: useTools ? this.tools : undefined,
      signal: this.signal,
    });
    return { response: result.response, usage: result.usage };
  }

  /**
   * Call the LLM with streaming and yield token events.
   */
  private async *callModelStreaming(prompt: string, ctx: RunContext): AsyncGenerator<AgentEvent, { response: AIMessage | string; usage?: TokenUsage }, unknown> {
    if (!this.streaming.showThinking) {
      // If thinking streaming is disabled, use regular call
      return this.callModel(prompt);
    }

    let fullContent = '';
    const tokenType: 'thinking' | 'answer' = 'thinking';

    try {
      for await (const chunk of callLlmStream(prompt, {
        model: this.model,
        systemPrompt: this.systemPrompt,
        tools: this.tools,
        signal: this.signal,
        streaming: true,
      })) {
        fullContent += chunk.content;

        // Yield token event for streaming
        yield {
          type: 'token',
          tokenType,
          content: chunk.content,
          isComplete: chunk.done,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      // If streaming fails, fall back to regular call
      const result = await this.callModel(prompt);
      return result;
    }

    // Return the accumulated content as response
    // Note: We can't get usage from streaming, so approximate
    return { response: fullContent, usage: undefined };
  }

  /**
   * Generate final answer with full scratchpad context.
   */
  private async *handleDirectResponse(
    responseText: string,
    ctx: RunContext
  ): AsyncGenerator<AgentEvent, void> {
    yield { type: 'answer_start' };
    const totalTime = Date.now() - ctx.startTime;
    yield {
      type: 'done',
      answer: responseText,
      toolCalls: [],
      iterations: ctx.iteration,
      totalTime,
      tokenUsage: ctx.tokenCounter.getUsage(),
      tokensPerSecond: ctx.tokenCounter.getTokensPerSecond(totalTime),
    };
  }

  /**
   * Generate final answer with full scratchpad context.
   */
  private async *generateFinalAnswer(
    ctx: RunContext,
    options?: { fallbackMessage?: string }
  ): AsyncGenerator<AgentEvent, void> {
    const fullContext = buildFinalAnswerContext(ctx.scratchpad);
    const finalPrompt = buildFinalAnswerPrompt(ctx.query, fullContext);

    yield { type: 'answer_start' };

    const useStreaming = this.streaming.enabled;

    let answer: string;
    let usage: TokenUsage | undefined;

    if (useStreaming) {
      // Stream the final answer tokens
      let fullContent = '';
      for await (const chunk of callLlmStream(finalPrompt, {
        model: this.model,
        systemPrompt: this.systemPrompt,
        streaming: true,
      })) {
        fullContent += chunk.content;

        // Yield token event for streaming answer
        yield {
          type: 'token',
          tokenType: 'answer',
          content: chunk.content,
          isComplete: chunk.done,
          timestamp: Date.now(),
        };
      }
      answer = fullContent;
    } else {
      const result = await this.callModel(finalPrompt, false);
      usage = result.usage;
      ctx.tokenCounter.add(usage);
      answer = typeof result.response === 'string'
        ? result.response
        : extractTextContent(result.response);
    }

    const totalTime = Date.now() - ctx.startTime;
    yield {
      type: 'done',
      answer: options?.fallbackMessage ? answer || options.fallbackMessage : answer,
      toolCalls: ctx.scratchpad.getToolCallRecords(),
      iterations: ctx.iteration,
      totalTime,
      tokenUsage: ctx.tokenCounter.getUsage(),
      tokensPerSecond: ctx.tokenCounter.getTokensPerSecond(totalTime),
    };
  }

  /**
   * Clear oldest tool results if context size exceeds threshold.
   */
  private *manageContextThreshold(ctx: RunContext): Generator<ContextClearedEvent, void> {
    const fullToolResults = ctx.scratchpad.getToolResults();
    const estimatedContextTokens = estimateTokens(this.systemPrompt + ctx.query + fullToolResults);

    if (estimatedContextTokens > CONTEXT_THRESHOLD) {
      const clearedCount = ctx.scratchpad.clearOldestToolResults(KEEP_TOOL_USES);
      if (clearedCount > 0) {
        yield { type: 'context_cleared', clearedCount, keptCount: KEEP_TOOL_USES };
      }
    }
  }

  /**
   * Build initial prompt with conversation history context if available
   */
  private buildInitialPrompt(
    query: string,
    inMemoryChatHistory?: InMemoryChatHistory
  ): string {
    if (!inMemoryChatHistory?.hasMessages()) {
      return query;
    }

    const userMessages = inMemoryChatHistory.getUserMessages();
    if (userMessages.length === 0) {
      return query;
    }

    const historyContext = userMessages.map((msg, i) => `${i + 1}. ${msg}`).join('\n');
    return `Current query to answer: ${query}\n\nPrevious user queries for context:\n${historyContext}`;
  }

}
