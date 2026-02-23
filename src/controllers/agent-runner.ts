import { Agent } from '../agent/agent.js';
import type { InMemoryChatHistory, Message } from '../utils/in-memory-chat-history.js';
import type {
  AgentConfig,
  AgentEvent,
  ApprovalDecision,
  DoneEvent,
} from '../agent/index.js';
import type { DisplayEvent } from '../agent/types.js';
import type { HistoryItem, HistoryItemStatus, WorkingState } from '../types.js';
import type { SessionMessage } from '../utils/session-store.js';

type ChangeListener = () => void;

export interface RunQueryResult {
  answer: string;
}

export class AgentRunnerController {
  private historyValue: HistoryItem[] = [];
  private workingStateValue: WorkingState = { status: 'idle' };
  private errorValue: string | null = null;
  private pendingApprovalValue: { tool: string; args: Record<string, unknown> } | null = null;
  private readonly agentConfig: AgentConfig;
  private readonly inMemoryChatHistory: InMemoryChatHistory;
  private readonly onChange?: ChangeListener;
  private abortController: AbortController | null = null;
  private approvalResolve: ((decision: ApprovalDecision) => void) | null = null;
  private sessionApprovedTools = new Set<string>();

  constructor(
    agentConfig: AgentConfig,
    inMemoryChatHistory: InMemoryChatHistory,
    onChange?: ChangeListener,
  ) {
    this.agentConfig = agentConfig;
    this.inMemoryChatHistory = inMemoryChatHistory;
    this.onChange = onChange;
  }

  get history(): HistoryItem[] {
    return this.historyValue;
  }

  get workingState(): WorkingState {
    return this.workingStateValue;
  }

  get error(): string | null {
    return this.errorValue;
  }

  get pendingApproval(): { tool: string; args: Record<string, unknown> } | null {
    return this.pendingApprovalValue;
  }

  get isProcessing(): boolean {
    return (
      this.historyValue.length > 0 && this.historyValue[this.historyValue.length - 1]?.status === 'processing'
    );
  }

  /**
   * Gets the approved tools set for session persistence
   */
  getApprovedTools(): string[] {
    return Array.from(this.sessionApprovedTools);
  }

  /**
   * Restores approved tools from a session
   */
  restoreApprovedTools(tools: string[]): void {
    this.sessionApprovedTools = new Set(tools);
  }

  /**
   * Gets the current messages in InMemoryChatHistory for session persistence
   */
  getMessages(): SessionMessage[] {
    const messages = this.inMemoryChatHistory.getMessages();
    return messages.map((m: Message) => ({
      id: m.id,
      query: m.query,
      answer: m.answer,
      summary: m.summary,
    }));
  }

  /**
   * Restores InMemoryChatHistory from a session
   */
  restoreMessages(messages: SessionMessage[]): void {
    // We need to restore the messages directly to the internal state
    // The InMemoryChatHistory has a clear() method, but we need to add messages back
    // Since there's no "restore" method, we'll access the internal messages array via the chatHistory
    // Actually, let's create a new InMemoryChatHistory and replace the reference
    // But we can't do that easily. Instead, let's add messages one by one

    // Actually the simplest approach is to clear and manually rebuild
    // But we don't have access to internal state. Let's just use the model's approach
    // We'll call the private method indirectly through the controller

    // Better approach: add a method to InMemoryChatHistory to restore messages
    // For now, let's just clear and use the model's getMessages which returns the array
    // Wait - the model is set in the constructor, we can't easily swap it

    // Actually, let's just reinitialize the chat history with the messages
    // The cleanest way is to add a restore method to InMemoryChatHistory
    // For now, let's skip this and handle it differently in cli.ts

    // Actually - we CAN access the inMemoryChatHistory, let's see if we can just
    // create a new instance and pass it. But the reference is already passed to Agent

    // Let's add a method to InMemoryChatHistory instead
    this.inMemoryChatHistory.restoreMessages(messages);
  }

  setError(error: string | null) {
    this.errorValue = error;
    this.emitChange();
  }

  respondToApproval(decision: ApprovalDecision) {
    if (!this.approvalResolve) {
      return;
    }
    this.approvalResolve(decision);
    this.approvalResolve = null;
    this.pendingApprovalValue = null;
    if (decision !== 'deny') {
      this.workingStateValue = { status: 'thinking' };
    }
    this.emitChange();
  }

  cancelExecution() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.approvalResolve) {
      this.approvalResolve('deny');
      this.approvalResolve = null;
      this.pendingApprovalValue = null;
    }
    this.markLastProcessing('interrupted');
    this.workingStateValue = { status: 'idle' };
    this.emitChange();
  }

  async runQuery(query: string): Promise<RunQueryResult | undefined> {
    this.abortController = new AbortController();
    let finalAnswer: string | undefined;

    const startTime = Date.now();
    const item: HistoryItem = {
      id: String(startTime),
      query,
      events: [],
      answer: '',
      status: 'processing',
      startTime,
    };
    this.historyValue = [...this.historyValue, item];
    this.inMemoryChatHistory.saveUserQuery(query);
    this.errorValue = null;
    this.workingStateValue = { status: 'thinking' };
    this.emitChange();

    try {
      const agent = await Agent.create({
        ...this.agentConfig,
        signal: this.abortController.signal,
        requestToolApproval: this.requestToolApproval,
        sessionApprovedTools: this.sessionApprovedTools,
      });
      const stream = agent.run(query, this.inMemoryChatHistory);
      for await (const event of stream) {
        if (event.type === 'done') {
          finalAnswer = (event as DoneEvent).answer;
        }
        await this.handleEvent(event);
      }
      if (finalAnswer) {
        return { answer: finalAnswer };
      }
      return undefined;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.markLastProcessing('interrupted');
        this.workingStateValue = { status: 'idle' };
        this.emitChange();
        return undefined;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.errorValue = message;
      this.markLastProcessing('error');
      this.workingStateValue = { status: 'idle' };
      this.emitChange();
      return undefined;
    } finally {
      this.abortController = null;
    }
  }

  private requestToolApproval = (request: { tool: string; args: Record<string, unknown> }) => {
    return new Promise<ApprovalDecision>((resolve) => {
      this.approvalResolve = resolve;
      this.pendingApprovalValue = request;
      this.workingStateValue = { status: 'approval', toolName: request.tool };
      this.emitChange();
    });
  };

  private async handleEvent(event: AgentEvent) {
    switch (event.type) {
      case 'thinking':
        this.workingStateValue = { status: 'thinking' };
        this.pushEvent({
          id: `thinking-${Date.now()}`,
          event,
          completed: true,
        });
        break;
      case 'tool_start': {
        const toolId = `tool-${event.tool}-${Date.now()}`;
        this.workingStateValue = { status: 'tool', toolName: event.tool };
        this.updateLastItem((last) => ({
          ...last,
          activeToolId: toolId,
          events: [
            ...last.events,
            {
              id: toolId,
              event,
              completed: false,
            } as DisplayEvent,
          ],
        }));
        break;
      }
      case 'tool_progress':
        this.updateLastItem((last) => ({
          ...last,
          events: last.events.map((entry) =>
            entry.id === last.activeToolId ? { ...entry, progressMessage: event.message } : entry,
          ),
        }));
        break;
      case 'tool_end':
        this.finishToolEvent(event);
        this.workingStateValue = { status: 'thinking' };
        break;
      case 'tool_error':
        this.finishToolEvent(event);
        this.workingStateValue = { status: 'thinking' };
        break;
      case 'tool_approval':
        this.pushEvent({
          id: `approval-${event.tool}-${Date.now()}`,
          event,
          completed: true,
        });
        break;
      case 'tool_denied':
        this.pushEvent({
          id: `denied-${event.tool}-${Date.now()}`,
          event,
          completed: true,
        });
        break;
      case 'tool_limit':
      case 'context_cleared':
        this.pushEvent({
          id: `${event.type}-${Date.now()}`,
          event,
          completed: true,
        });
        break;
      case 'answer_start':
        this.workingStateValue = { status: 'answering', startTime: Date.now() };
        break;
      case 'done': {
        const done = event as DoneEvent;
        if (done.answer) {
          await this.inMemoryChatHistory.saveAnswer(done.answer).catch(() => {});
        }
        this.updateLastItem((last) => ({
          ...last,
          answer: done.answer,
          status: 'complete',
          duration: done.totalTime,
          tokenUsage: done.tokenUsage,
          tokensPerSecond: done.tokensPerSecond,
        }));
        this.workingStateValue = { status: 'idle' };
        break;
      }
    }
    this.emitChange();
  }

  private finishToolEvent(event: AgentEvent) {
    this.updateLastItem((last) => ({
      ...last,
      activeToolId: undefined,
      events: last.events.map((entry) =>
        entry.id === last.activeToolId ? { ...entry, completed: true, endEvent: event } : entry,
      ),
    }));
  }

  private pushEvent(displayEvent: DisplayEvent) {
    this.updateLastItem((last) => ({ ...last, events: [...last.events, displayEvent] }));
  }

  private updateLastItem(updater: (item: HistoryItem) => HistoryItem) {
    const last = this.historyValue[this.historyValue.length - 1];
    if (!last || last.status !== 'processing') {
      return;
    }
    const next = updater(last);
    this.historyValue = [...this.historyValue.slice(0, -1), next];
  }

  private markLastProcessing(status: HistoryItemStatus) {
    const last = this.historyValue[this.historyValue.length - 1];
    if (!last || last.status !== 'processing') {
      return;
    }
    this.historyValue = [...this.historyValue.slice(0, -1), { ...last, status }];
  }

  private emitChange() {
    this.onChange?.();
  }
}
