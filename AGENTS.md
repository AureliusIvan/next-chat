## RAG Chatbot (LlamaIndex + OpenAI + TanStack) — Developer Guide

This repo is a Next.js chatbot using LlamaIndex (TS) with OpenAI, local client-side storage via TanStack Query + localStorage, and shadcn/tailwind UI components. It’s designed to be easy to run, extend with tools/RAG, and debug.

### Prerequisites
- Node 18+ and pnpm
- Environment: set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`)
- pnpm 

## Architecture at a glance
- UI
  - `src/app/_components/ChatLayout.tsx` — layout and conversation selection
  - `src/app/_components/ChatInterface.tsx` — messages list + input
  - `src/app/_components/ChatBubble.tsx` — message display + analytics modal
  - UI primitives: `src/components/ui/*` (shadcn)
  - Providers: `src/components/providers.tsx` (React Query)

- Hooks (TanStack Query + client DB)
  - `src/app/_hooks/useAgent.tsx` — send message flow (creates user/assistant msgs, calls API, updates assistant)
  - `src/hooks/useMessages.ts` — message CRUD + optimistic updates
  - `src/hooks/useConversations.ts` — conversation CRUD + active selection

- API (Next Route Handlers)
  - `src/app/api/chat/route.ts` — POST chat, analytics, error handling
  - `src/app/api/health/route.ts` — GET health and metrics
  - `src/app/api/middleware/rate-limit.ts` — in-memory rate limiter wrapper

- Agent core (LlamaIndex + OpenAI)
  - `src/app/lib/agent-manager.ts` — initializes agent, tools, retries, circuit breaker
  - `src/app/lib/config.ts` — env validation and config
  - `src/app/lib/logger.ts` — structured logging
  - `src/app/lib/analytics.ts` — token estimate, cost calc, request metrics

- Storage (client-side)
  - `src/lib/db-config.ts` — localStorage wrappers + React Query defaults
  - `src/lib/database.ts` — shared types for conversations/messages

### Data flow
```text
User types → ChatInterface → useAgentChat
  → create user msg (optimistic) → create assistant placeholder
  → POST /api/chat → agent-manager.run() (LlamaIndex + OpenAI)
  → analytics + response → update assistant msg → UI re-render (React Query)
```

## API contract — POST `/api/chat`
Validated request (Zod) in `src/app/api/chat/route.ts`:
- `message: string` (required)
- `userId?: string`
- `sessionId?: string`

Note: The UI may also send `conversationId` and `conversationContext`; these are currently ignored by the validator/handler (safe to include, not required).

Successful response body (`EnhancedChatResponse`):
```json
{
  "response": {
    "data": {
      "message": {
        "role": "assistant",
        "content": "...",
        "toolCalls": []
      },
      "result": "...",
      "state": {}
    },
    "message": {
      "role": "assistant",
      "content": "...",
      "analytics": {
        "tokenUsage": {"promptTokens": 10, "completionTokens": 20, "totalTokens": 30},
        "responseTime": 123,
        "toolsUsed": [],
        "model": "gpt-4o-mini",
        "timestamp": "2025-01-01T00:00:00.000Z",
        "cost": 0.00001,
        "requestId": "req-..."
      }
    }
  },
  "requestId": "req-...",
  "processingTime": 456
}
```
Response headers: `X-Request-ID`, `X-Processing-Time`, and rate limit headers if the middleware is applied.

Errors use a structured JSON with `error.message`, `error.code`, `requestId`.

## Agent (LlamaIndex + OpenAI)
Defined in `src/app/lib/agent-manager.ts`:
- Uses `@llamaindex/workflow` and `@llamaindex/openai`.
- Registers a sample `greet` tool. Add tools similarly, then include them when constructing the agent.

Minimal tool example:
```ts
import { tool } from 'llamaindex'
import { z } from 'zod'

const myTool = tool({
  name: 'my_tool',
  description: 'Does something useful',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => `You asked: ${query}`,
})

// In agent init
const agentInstance = agent({ tools: [myTool], llm: openai({ model, apiKey }) })
```

Result normalization: `agent-manager` converts LlamaIndex result parts into plain string `message.content` and `result` for consistent UI handling.

## Client DB (TanStack) and optimistic updates
- Types: `src/lib/database.ts`
- Storage: `src/lib/db-config.ts` (localStorage)
- Hooks: `src/hooks/useMessages.ts`, `src/hooks/useConversations.ts`

Important gotcha (fixed): when creating an assistant placeholder, use the `id` returned by the mutation for subsequent updates. Don’t rely on a locally generated ID or the UI won’t update the intended record.

## Rate limiting and health
- Rate limit wrapper: `withRateLimit` (`src/app/api/middleware/rate-limit.ts`) — sets headers and 429 responses.
- Health: `GET /api/health` (`src/app/api/health/route.ts`), add `?metrics=true` for CPU/memory in dev.

## Styling
- shadcn components in `src/components/ui/*`, tailwind utility classes in components.

## Configuration
`src/app/lib/config.ts` validates env with Zod. Useful vars:
- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (default `gpt-4o-mini`)
- `LOG_LEVEL` (`debug|info|warn|error`)
- Rate limit and retry/circuit settings available as envs.

## Scripts
```bash
pnpm dev     # Next dev (Turbopack)
pnpm build   # Next build
pnpm start   # Next start
pnpm lint    # biome check
pnpm format  # biome format --write
```

## References
- LlamaIndex (TS): [docs](https://ts.llamaindex.ai)
- TanStack Query: [docs](https://tanstack.com/query/latest)
- shadcn/ui: [docs](https://ui.shadcn.com)
- Tailwind CSS: [docs](https://tailwindcss.com)
- Next.js App Router: [docs](https://nextjs.org/docs)
