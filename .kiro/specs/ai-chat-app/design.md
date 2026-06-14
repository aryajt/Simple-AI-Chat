# Design Document — AI Chat App

## Overview

The AI Chat App is a full-stack conversational AI application modelled after interfaces like ChatGPT. It is structured as a **NestJS monorepo** containing three independently deployable applications and one shared library. The user interacts with a Next.js 14 frontend; messages flow through a REST API, are handed off to an AI microservice via NATS, and the AI response is streamed back to the browser over Server-Sent Events (SSE).

All components are containerised and orchestrated by Docker Compose. PostgreSQL provides durable storage; TypeORM migrations manage the schema. The AI microservice uses a fully deterministic keyword-matching engine — no external LLM calls are made.

### Key Design Goals

| Goal | Decision |
|---|---|
| Decoupled services | API and AI-Service communicate exclusively over NATS |
| Real-time response delivery | SSE instead of polling keeps the HTTP layer stateless |
| Shared contract | `libs/shared` holds DTOs, NATS subjects, and response types |
| Zero-dependency AI | Mock response generator is a pure, deterministic function |
| One-command startup | Docker Compose with health-checked dependency ordering |

---

## Architecture

### System Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser                                                            │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Next.js 14 Frontend  (apps/frontend)                      │    │
│  │  ┌──────────────┐  ┌─────────────────────────────────────┐│    │
│  │  │  Sidebar     │  │  Chat Panel                         ││    │
│  │  │  (conv list) │  │  (message history + input)          ││    │
│  │  └──────────────┘  └─────────────────────────────────────┘│    │
│  └───────────────────────────────────┬────────────────────────┘    │
│                REST / SSE            │                              │
└──────────────────────────────────────┼──────────────────────────────┘
                                       │ HTTP :3000
                          ┌────────────▼────────────────┐
                          │  NestJS API Server           │
                          │  (apps/api)                  │
                          │                              │
                          │  • REST Controllers          │
                          │  • SSE Gateway               │
                          │  • ConversationService       │
                          │  • MessageService            │
                          │  • NatsClientModule          │
                          └──────┬──────────┬────────────┘
                                 │          │
                         NATS    │          │  TypeORM
                    ai.request   │          │
                                 │   ┌──────▼──────┐
                   ┌─────────────▼─┐ │  PostgreSQL │
                   │  NATS Broker  │ │  :5432      │
                   │  :4222        │ └─────────────┘
                   └─────────────┬─┘
                    ai.response  │
                          ┌──────▼──────────────────────┐
                          │  NestJS AI Microservice      │
                          │  (apps/ai-service)           │
                          │                              │
                          │  • NATS MessagePattern       │
                          │  • MockResponseGenerator     │
                          └─────────────────────────────┘
```

### Request / Response Data Flow

#### Sending a Message (Happy Path)

```
Browser                  Frontend           API Server           NATS           AI Service        DB
  │                          │                   │                 │                 │              │
  │─── submit message ──────►│                   │                 │                 │              │
  │                          │─── POST /conversations/:id/messages►│                 │              │
  │                          │                   │─── INSERT user msg ──────────────────────────────►│
  │                          │                   │◄── saved ────────────────────────────────────────│
  │                          │                   │─── publish ai.request ──────────►│               │
  │                          │◄─ 201 user msg ───│                 │                 │              │
  │◄── input disabled ───────│                   │                 │                 │              │
  │                          │                   │                 │─── ai.request ─►│              │
  │                          │                   │                 │                 │─ generate ──►│
  │                          │                   │                 │◄── ai.response ─│              │
  │                          │                   │◄─ ai.response ──│                 │              │
  │                          │                   │─── INSERT assistant msg ─────────────────────────►│
  │                          │                   │◄── saved ────────────────────────────────────────│
  │                          │                   │──── SSE event ──►│               │              │
  │                          │◄─── SSE event ────│                 │                 │              │
  │◄── append msg, re-enable ─│                  │                 │                 │              │
```

#### Loading Conversation History

```
Browser          Frontend              API Server                DB
  │                  │                      │                     │
  │── select conv ──►│                      │                     │
  │                  │── GET /convs/:id/messages ────────────────►│
  │                  │                      │── SELECT msgs ASC ─►│
  │                  │                      │◄── rows ────────────│
  │                  │◄──── 200 messages ───│                     │
  │◄── render msgs ──│                      │                     │
```

---

## Components and Interfaces

### Monorepo Directory Structure

```
/
├── apps/
│   ├── api/                          # NestJS REST + SSE server
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── conversations/
│   │   │   │   ├── conversations.controller.ts
│   │   │   │   ├── conversations.service.ts
│   │   │   │   └── conversations.module.ts
│   │   │   ├── messages/
│   │   │   │   ├── messages.controller.ts
│   │   │   │   ├── messages.service.ts
│   │   │   │   └── messages.module.ts
│   │   │   ├── events/
│   │   │   │   ├── events.controller.ts   # SSE endpoint
│   │   │   │   └── events.service.ts      # Subject/observer per conversation
│   │   │   ├── nats/
│   │   │   │   ├── nats.module.ts
│   │   │   │   └── nats-subscriber.service.ts
│   │   │   └── database/
│   │   │       ├── database.module.ts
│   │   │       └── migrations/
│   │   └── Dockerfile
│   │
│   ├── ai-service/                   # NestJS NATS microservice
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── ai/
│   │   │   │   ├── ai.controller.ts   # @MessagePattern(NATS_SUBJECTS.AI_REQUEST)
│   │   │   │   ├── ai.service.ts
│   │   │   │   └── ai.module.ts
│   │   │   └── mock-response/
│   │   │       └── mock-response.generator.ts
│   │   └── Dockerfile
│   │
│   └── frontend/                     # Next.js 14 App Router
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   └── conversations/
│       │       └── [id]/
│       │           └── page.tsx
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── ConversationList.tsx
│       │   ├── ChatPanel.tsx
│       │   ├── MessageList.tsx
│       │   ├── MessageInput.tsx
│       │   └── LoadingIndicator.tsx
│       ├── hooks/
│       │   ├── useConversations.ts
│       │   ├── useMessages.ts
│       │   └── useSSE.ts
│       ├── lib/
│       │   └── api-client.ts
│       ├── next.config.js
│       └── Dockerfile
│
├── libs/
│   └── shared/
│       └── src/
│           ├── index.ts
│           ├── dto/
│           │   ├── create-conversation.dto.ts
│           │   ├── create-message.dto.ts
│           │   ├── conversation.dto.ts
│           │   └── message.dto.ts
│           ├── subjects.ts            # NATS subject constants
│           └── types.ts               # Shared enums (MessageRole)
│
├── docker-compose.yml
├── nest-cli.json
├── package.json
└── tsconfig.json
```

### API Server — Key Interfaces

```typescript
// ConversationsController
POST   /conversations                → CreateConversationDto → ConversationDto
GET    /conversations                → ConversationDto[]  (desc by createdAt)

// MessagesController
GET    /conversations/:id/messages   → MessageDto[]  (asc by createdAt)
POST   /conversations/:id/messages   → CreateMessageDto → MessageDto

// EventsController
GET    /conversations/:id/events     → text/event-stream  (SSE)
```

### Shared Library — `libs/shared`

```typescript
// subjects.ts
export const NATS_SUBJECTS = {
  AI_REQUEST:  'ai.request',
  AI_RESPONSE: 'ai.response',
} as const;

// types.ts
export enum MessageRole {
  USER      = 'user',
  ASSISTANT = 'assistant',
}

// dto/conversation.dto.ts
export class ConversationDto {
  id:        string;   // UUID
  title:     string;
  createdAt: string;   // ISO-8601
}

// dto/message.dto.ts
export class MessageDto {
  id:             string;      // UUID
  conversationId: string;      // UUID FK
  role:           MessageRole;
  content:        string;
  createdAt:      string;      // ISO-8601
}

// NATS payloads (plain objects, not classes)
export interface AiRequestPayload  { conversationId: string; content: string; }
export interface AiResponsePayload { conversationId: string; content: string; }
```

### AI Service — MockResponseGenerator

The generator is a **pure function** with no side effects. It follows this priority chain:

1. **Keyword match** — case-insensitive scan of input against a keyword map; returns associated fixed reply.
2. **Echo fallback** — wraps input in `"You said: <input>"` for unmatched input.
3. **Empty-input guard** — returns a fixed default string `"Hello! How can I help you?"` if input is empty or whitespace.

```typescript
// Keyword map (fixed at compile time)
const KEYWORD_RESPONSES: Record<string, string> = {
  'hello':     'Hello! How can I help you today?',
  'hi':        'Hi there! What can I do for you?',
  'help':      'Sure! I am here to help. What do you need?',
  'bye':       'Goodbye! Have a great day!',
  'thanks':    'You are welcome!',
  'weather':   'I am not connected to weather data, but I hope it is sunny!',
  'joke':      'Why do programmers prefer dark mode? Because light attracts bugs!',
  'time':      'I do not have access to real-time data, but your device clock knows!',
};

export function generateMockResponse(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length === 0) return 'Hello! How can I help you?';
  for (const [keyword, response] of Object.entries(KEYWORD_RESPONSES)) {
    if (trimmed.includes(keyword)) return response;
  }
  return `You said: "${input.trim()}"`;
}
```

### SSE Events Service

Each active SSE connection is modelled as an RxJS `Subject<MessageDto>`. The `EventsService` holds a `Map<conversationId, Subject<MessageDto>>`. When the NATS subscriber receives an `ai.response` event and the assistant message is persisted, it pushes the `MessageDto` to the relevant subject. The SSE controller subscribes and pipes events to the HTTP response via NestJS `@Sse()`.

```typescript
// EventsService (simplified)
class EventsService {
  private subjects = new Map<string, Subject<MessageDto>>();

  getOrCreate(conversationId: string): Subject<MessageDto> { ... }
  emit(conversationId: string, message: MessageDto): void { ... }
  cleanup(conversationId: string): void { ... }
}
```

---

## Data Models

### Entity Relationship Diagram

```
┌──────────────────────────────────┐        ┌──────────────────────────────────────┐
│  conversations                   │        │  messages                            │
├──────────────────────────────────┤        ├──────────────────────────────────────┤
│  id          UUID  PK            │◄──FK───│  id              UUID  PK            │
│  title       VARCHAR(255)        │        │  conversationId   UUID  FK  NOT NULL  │
│  createdAt   TIMESTAMP           │        │  role            ENUM(user,assistant)│
└──────────────────────────────────┘        │  content         TEXT  NOT NULL      │
                                             │  createdAt       TIMESTAMP           │
                                             └──────────────────────────────────────┘
```

### TypeORM Entities

```typescript
// Conversation entity
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, default: 'New Conversation' })
  title: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Message, (msg) => msg.conversation)
  messages: Message[];
}

// Message entity
@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  conversationId: string;

  @Column({ type: 'enum', enum: MessageRole })
  role: MessageRole;

  @Column('text')
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;
}
```

### Migration Strategy

TypeORM migrations are stored under `apps/api/src/database/migrations/`. Two migrations are created at project setup:

1. `CreateConversationsTable` — creates the `conversations` table with UUID primary key.
2. `CreateMessagesTable` — creates the `messages` table with FK constraint referencing `conversations.id`.

The API server runs `typeorm migration:run` on startup before accepting requests.

---

## API Contract

### `POST /conversations`

```
Request body (optional):
{
  "title": "string"   // omit to use default "New Conversation"
}

Response 201:
{
  "id":        "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  "title":     "New Conversation",
  "createdAt": "2024-01-15T10:30:00.000Z"
}

Response 503: { "message": "Service unavailable" }
```

### `GET /conversations`

```
Response 200: Array of ConversationDto sorted descending by createdAt
[
  { "id": "...", "title": "...", "createdAt": "..." },
  ...
]
```

### `GET /conversations/:id/messages`

```
Response 200: Array of MessageDto sorted ascending by createdAt
[
  { "id": "...", "conversationId": "...", "role": "user",      "content": "...", "createdAt": "..." },
  { "id": "...", "conversationId": "...", "role": "assistant", "content": "...", "createdAt": "..." }
]

Response 404: { "message": "Conversation not found" }
```

### `POST /conversations/:id/messages`

```
Request body (required):
{
  "content": "string"   // must be non-empty, non-whitespace
}

Response 201: MessageDto (user message, persisted)
{
  "id":             "...",
  "conversationId": "...",
  "role":           "user",
  "content":        "Hello",
  "createdAt":      "..."
}

Response 400: { "message": "Content must not be empty" }
Response 404: { "message": "Conversation not found" }
```

### `GET /conversations/:id/events` (SSE)

```
Headers:
  Accept: text/event-stream
  Cache-Control: no-cache

Stream events:
data: {"id":"...","conversationId":"...","role":"assistant","content":"...","createdAt":"..."}

The stream remains open until the client disconnects.
On connection, no historical messages are sent — only future assistant messages for this conversation.
```

---

## Environment Variables

| Variable | Service(s) | Description | Example |
|---|---|---|---|
| `DATABASE_HOST` | api | PostgreSQL hostname | `postgres` |
| `DATABASE_PORT` | api | PostgreSQL port | `5432` |
| `DATABASE_NAME` | api | Database name | `chatapp` |
| `DATABASE_USER` | api | Database username | `chatapp` |
| `DATABASE_PASSWORD` | api | Database password | `chatapp_secret` |
| `NATS_URL` | api, ai-service | NATS connection URL | `nats://nats:4222` |
| `API_PORT` | api | HTTP port for REST/SSE | `3000` |
| `NEXT_PUBLIC_API_URL` | frontend | Base URL for REST calls | `http://localhost:3000` |
| `NEXT_PUBLIC_SSE_URL` | frontend | Base URL for SSE connections | `http://localhost:3000` |
| `FRONTEND_PORT` | frontend | Next.js HTTP port | `3001` |

---

## Docker Compose Architecture

```yaml
# docker-compose.yml (structural overview)

services:
  postgres:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 5
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  nats:
    image: nats:2-alpine
    healthcheck:
      test: ["CMD", "/nats-server", "--help"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  api:
    build: ./apps/api
    depends_on:
      postgres: { condition: service_healthy }
      nats:     { condition: service_healthy }
    environment:
      DATABASE_HOST: postgres
      NATS_URL: nats://nats:4222
    restart: unless-stopped
    ports:
      - "${API_PORT:-3000}:3000"

  ai-service:
    build: ./apps/ai-service
    depends_on:
      nats: { condition: service_healthy }
    environment:
      NATS_URL: nats://nats:4222
    restart: unless-stopped

  frontend:
    build: ./apps/frontend
    depends_on:
      - api
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:${API_PORT:-3000}
    restart: unless-stopped
    ports:
      - "${FRONTEND_PORT:-3001}:3001"

volumes:
  postgres_data:
```

### Startup Order

```
postgres ──health──► api ──ready──► (accepts HTTP)
nats     ──health──► api
nats     ──health──► ai-service ──ready──► (listens on NATS)
api      ──started──► frontend
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property-based testing applies here because the system has pure functions (mock response generator), ordering invariants (conversation/message list sorting), and schema validation logic (whitespace rejection, field presence) that are universal across all valid inputs.

### Property 1: Conversation creation response includes all required fields

*For any* valid conversation creation request (with or without an explicit title), the API response SHALL contain a non-null UUID `id`, a non-empty `title` string, and a valid ISO-8601 `createdAt` timestamp.

**Validates: Requirements 1.1, 1.3**

---

### Property 2: Conversation list is ordered descending by creation time

*For any* non-empty collection of conversations with distinct or equal creation timestamps, the list returned by `GET /conversations` SHALL be ordered such that `conversations[i].createdAt >= conversations[i+1].createdAt` for all valid indices `i`.

**Validates: Requirements 2.2**

---

### Property 3: Whitespace-only message content is always rejected

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines, or any combination thereof), submitting it as message content SHALL cause the API to respond with HTTP status 400.

**Validates: Requirements 3.5**

---

### Property 4: User message persistence includes all required fields

*For any* non-empty, non-whitespace message content string, the message record persisted to the database after a successful `POST /conversations/:id/messages` SHALL have: a non-null UUID `id`, the matching `conversationId`, role equal to `"user"`, the exact content string, and a valid `createdAt` timestamp.

**Validates: Requirements 3.2**

---

### Property 5: Assistant message persistence includes all required fields

*For any* AI response payload `{ conversationId, content }` received from NATS, the message record persisted SHALL have: a non-null UUID `id`, the matching `conversationId`, role equal to `"assistant"`, the exact response content, and a valid `createdAt` timestamp.

**Validates: Requirements 4.4**

---

### Property 6: Mock generator always produces a non-empty output

*For any* input string — including the empty string, whitespace-only strings, strings with special characters, and arbitrarily long strings — `generateMockResponse(input)` SHALL return a string of length ≥ 1.

**Validates: Requirements 4.2, 10.2**

---

### Property 7: Mock generator is deterministic

*For any* input string `s`, calling `generateMockResponse(s)` twice in succession SHALL produce identical output strings. The function has no hidden state and no randomness.

**Validates: Requirements 10.3**

---

### Property 8: Keyword matching always returns the associated fixed response

*For any* keyword `k` in the predefined keyword map, and for any input string that contains `k` (case-insensitively) and matches no higher-priority keyword, `generateMockResponse(input)` SHALL return exactly the predefined response string associated with `k`.

**Validates: Requirements 10.5**

---

### Property 9: Message history is ordered ascending by creation time

*For any* conversation containing multiple messages with distinct or equal creation timestamps, the list returned by `GET /conversations/:id/messages` SHALL be ordered such that `messages[i].createdAt <= messages[i+1].createdAt` for all valid indices `i`.

**Validates: Requirements 5.2**

---

### Property 10: FK constraint rejects messages with non-existent conversation IDs

*For any* UUID that does not correspond to an existing conversation record, attempting to insert a message with that `conversationId` SHALL be rejected with a database constraint error.

**Validates: Requirements 8.5**

---

### Property Reflection

After reviewing the ten properties above:

- Properties 6 and 7 are complementary, not redundant: non-emptiness and determinism are independent invariants of the mock generator. Both are retained.
- Properties 4 and 5 share the same field-presence structure but validate different roles (`user` vs `assistant`) and different trigger paths (REST vs NATS). Both are retained.
- Properties 2 and 9 test opposite orderings (`DESC` vs `ASC`) on different entities. Both are retained.
- Property 1 subsumes the response-shape check in Requirement 1.3, which is why 1.3 is not listed separately.

No further consolidation is needed.

---

## Error Handling

### API Server

| Scenario | Behaviour |
|---|---|
| DB unavailable at startup (first connect fails) | Log error, `process.exit(1)` |
| DB unavailable during request | Return HTTP 503 |
| Conversation not found | Return HTTP 404 |
| Empty / whitespace message content | Return HTTP 400 |
| NATS unavailable at startup | Log each retry; keep retrying indefinitely |
| AI Service timeout (30 s) | Persist assistant message with `"[AI service timed out]"` content; emit via SSE |

### AI Service

| Scenario | Behaviour |
|---|---|
| NATS unavailable at startup | Log each retry; keep retrying indefinitely |
| Malformed `ai.request` payload | Log warning; discard message (do not reply) |

### Frontend

| Scenario | Behaviour |
|---|---|
| `GET /conversations` fails | Display error notification banner |
| `POST /conversations` fails | Display error notification; remove optimistic entry from list |
| `POST /conversations/:id/messages` fails | Display error notification; re-enable input |
| SSE connection dropped | Attempt reconnect with `EventSource` built-in retry |
| `GET /conversations/:id/messages` fails | Display error in chat panel |

---

## Testing Strategy

### Dual Testing Approach

Unit tests cover specific examples, edge cases, and error conditions. Property-based tests (using **fast-check** for TypeScript) verify universal properties across hundreds of generated inputs. Both are complementary and necessary for full correctness coverage.

### Unit Tests

**API Server**
- `ConversationsService`: create with/without title, list ordering, 503 on DB failure
- `MessagesService`: persist user message, 400 on empty content, 404 on unknown conversation
- `EventsService`: subject creation, emit, cleanup
- `NatsSubscriberService`: assistant message persistence on `ai.response` event, timeout handling

**AI Service**
- `AiController`: delegates to service on `ai.request` pattern
- `AiService`: publishes to `ai.response` with correct payload

**Frontend**
- `ConversationList`: renders each conversation title; renders empty state
- `MessageList`: renders messages with role distinction; renders empty state
- `MessageInput`: disables on submit; re-enables on response; submits with Enter key
- `useSSE`: connects on mount; appends message on event; attempts reconnect on close

### Property-Based Tests (fast-check)

Each test runs a minimum of **100 iterations**. Tag format: `Feature: ai-chat-app, Property N: <property text>`.

| Test File | Property | fast-check Arbitrary |
|---|---|---|
| `mock-response.spec.ts` | Property 6: non-empty output | `fc.string()` incl. empty |
| `mock-response.spec.ts` | Property 7: determinism | `fc.string()` |
| `mock-response.spec.ts` | Property 8: keyword matching | `fc.constantFrom(...keywords)` + surrounding text |
| `conversations.service.spec.ts` | Property 2: DESC ordering | `fc.array(fc.record({ createdAt: fc.date() }))` |
| `messages.service.spec.ts` | Property 9: ASC ordering | `fc.array(fc.record({ createdAt: fc.date() }))` |
| `messages.service.spec.ts` | Property 3: whitespace rejection | `fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'))` |
| `conversations.service.spec.ts` | Property 1: response shape | `fc.option(fc.string({ minLength: 1 }))` for title |
| `messages.service.spec.ts` | Property 4: user message fields | `fc.string({ minLength: 1 })` for content |

Properties 5 (assistant persistence), 10 (FK constraint) are covered by integration tests using a test PostgreSQL instance rather than property-based unit tests because they involve database I/O that requires careful setup and would be expensive to run at 100× scale in CI without a running database. They are tested with 3–5 representative examples.

### Integration Tests

- Full message round-trip: POST message → NATS → AI Service → NATS → API → SSE → client
- FK constraint: insert message with random UUID `conversationId` not in DB → verify error
- `GET /conversations/:id/events`: verify SSE stream delivers assistant message

### Test Commands

```bash
# Unit + property tests
npm run test

# Watch mode (development)
npm run test:watch

# Coverage
npm run test:cov

# E2E / integration
npm run test:e2e
```
