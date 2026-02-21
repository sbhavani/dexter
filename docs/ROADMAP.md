# Roadmap

Future enhancements beyond the completed PRD scope.

## Completed (from original PRD)

All P0–P2 user stories are implemented. See [PRD.md](PRD.md) for details.

Key milestones:
- Core research workflow (task planning → execution → self-validation → answer)
- Multi-provider LLM support (OpenAI, Anthropic, Google, xAI, OpenRouter, Ollama)
- Debugging via scratchpad JSONL files
- Evaluation framework with LangSmith and LLM-as-judge
- WhatsApp gateway integration
- Web search via Exa and Tavily

## Ideas (Unprioritized)

These are potential directions. None have user stories or acceptance criteria yet — they need to be scoped before work begins.

- **Memory/Context**: Persist conversation history across sessions
- **Structured Output**: Return answers in JSON/CSV for programmatic use
- **Telegram/Slack Integration**: Additional messaging platforms beyond WhatsApp
- **Streaming Responses**: Real-time token-by-token output during thinking
- **Multiple Data Sources**: Bloomberg, Yahoo Finance, Alpha Vantage integrations
- **Portfolio Analysis**: Analyze holdings across multiple stocks
- **Report Generation**: PDF/HTML report output
- **Scheduled Research**: Run queries on cron schedule
- **Agent Collaboration**: Multiple agents working on different aspects

## Won't Have

- **Real-time Trading**: Executing trades — beyond scope, safety concerns
- **Mobile App**: Native iOS/Android — web-based gateway sufficient
- **Enterprise SSO**: Current simple auth sufficient for individual use

## Lessons Learned

From building Dexter:

1. **Good**: Scratchpad JSONL debugging essential for agent behavior analysis
2. **Good**: Eval framework with LLM-as-judge provides meaningful accuracy metrics
3. **Good**: Multi-provider support allows flexibility and cost optimization
4. **Issue**: Loop detection needs tuning for complex research paths
5. **Fix**: Step limits prevent runaway but may truncate valid complex analyses
