# Implementation Plan: AI Chat App

## Overview

Implement a full-stack AI chat application as a NestJS monorepo (REST API + AI microservice) with a Next.js 14 frontend, NATS message broker, PostgreSQL persistence via TypeORM, SSE real-time delivery, and Docker Compose orchestration. The AI microservice uses a deterministic mock response generator — no external LLM calls. All inter-service communication flows through NATS subjects defined in `libs/shared`.

Tasks are ordered so that shared contracts and infrastructure come first, then backend, then frontend, then Docker, then tests. Every task builds directly on the one before it; no code is left unintegrated.

---

## Tasks

- [x] 1. Scaffold the NestJS monorepo and configure the root workspace
  - Run `nest new` in monorepo mode and produce the root `nest-cli.json`, `tsconfig.json`, and `package.json`
  - `nest-cli.json` must declare `compilerOptions.webpack: false`, list `apps/api`, `apps/ai-service` as projects, and configure `libs/shared` as a library
  - Root `tsconfig.json` must define path aliases `@app/shared` → `libs/shared/src`
  - Root `package.json` must expose scripts: `start:api`, `start:ai`, `build:api`, `build:ai`, `test`, `test:cov`, `test:e2e`
  - Install shared dev dependencies: `@nestjs/cli`, `@nestjs/testing`, `jest`, `ts-jest`, `fast-check`, `supertest`
  - _Requirements: 7.1, 7.2, 9.1_

- [x] 2. Create the shared library (`libs/shared`)
  - [x] 2.1 Create NATS subject constants and `MessageRole` enum
    - Create `libs/shared/src/subjects.ts` exporting `NATS_SUBJECTS = { AI_REQUEST: 'ai.request', AI_RESPONSE: 'ai.response' }`
    - Create `libs/shared/src/types.ts` exporting `enum MessageRole { USER = 'user', ASSISTANT = 'assistant' }`
    - _Requirements: 7.3, 7.4_
  - [x] 2.2 Create shared DTOs
    - Create `libs/shared/src/dto/conversation.dto.ts` with `ConversationDto { id, title, createdAt }`
    - Create `libs/shared/src/dto/create-conversation.dto.ts` with optional `title` field and `@IsOptional()` / `@IsString()` validators
    - Create `libs/shared/src/dto/message.dto.ts` with `MessageDto { id, conversationId, role, content, createdAt }`
    - Create `libs/shared/src/dto/create-message.dto.ts` with required `content: string` and `@IsNotEmpty()` validator
    - Export `AiRequestPayload` and `AiResponsePayload` interfaces in `libs/shared/src/types.ts`
    - Re-export everything from `libs/shared/src/index.ts`
    - _Requirements: 3.2, 4.4, 8.1, 8.2_

- [x] 3. Set up the database layer in `apps/api`
  - [x] 3.1 Configure TypeORM and create the `Conversation` entity
    - Create `apps/api/src/database/database.module.ts` that reads env vars (`DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`) and sets `migrationsRun: true`, `synchronize: false`
    - Create `apps/api/src/conversations/entities/conversation.entity.ts` with `@Entity('conversations')`, UUID PK, `title VARCHAR(255)` with default `'New Conversation'`, and `@CreateDateColumn() createdAt`
    - _Requirements: 8.1, 8.3_
  - [x] 3.2 Create the `Message` entity
    - Create `apps/api/src/messages/entities/message.entity.ts` with `@Entity('messages')`, UUID PK, `conversationId UUID FK`, `role ENUM(user,assistant)`, `content TEXT NOT NULL`, `@CreateDateColumn() createdAt`
    - Add `@ManyToOne(() => Conversation, { onDelete: 'CASCADE' })` with `@JoinColumn({ name: 'conversationId' })`
    - Add `@OneToMany(() => Message, ...)` back-reference on `Conversation`
    - _Requirements: 8.2, 8.5_
  - [x] 3.3 Write TypeORM migrations
    - Create migration `apps/api/src/database/migrations/<timestamp>-CreateConversationsTable.ts` that creates the `conversations` table (id UUID PK, title VARCHAR(255) NOT NULL DEFAULT 'New Conversation', createdAt TIMESTAMP)
    - Create migration `apps/api/src/database/migrations/<timestamp>-CreateMessagesTable.ts` that creates the `messages` table with FK `conversationId REFERENCES conversations(id) ON DELETE CASCADE` and a CHECK constraint on `role`
    - _Requirements: 8.3, 8.5_

- [x] 4. Implement the Conversations module in `apps/api`
  - [x] 4.1 Create `ConversationsService`
    - Create `apps/api/src/conversations/conversations.service.ts`
    - Implement `create(dto: CreateConversationDto): Promise<ConversationDto>` — insert a new row, use default title when `dto.title` is absent, wrap DB errors with HTTP 503
    - Implement `findAll(): Promise<ConversationDto[]>` — return all rows ordered by `createdAt DESC`
    - Catch `TypeORMError` on connection failure and throw `ServiceUnavailableException`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2_
  - [x] 4.2 Create `ConversationsController`
    - Create `apps/api/src/conversations/conversations.controller.ts`
    - `POST /conversations` → calls `ConversationsService.create()`, returns 201 with `ConversationDto`
    - `GET /conversations` → calls `ConversationsService.findAll()`, returns 200 with `ConversationDto[]`
    - Apply `ValidationPipe` globally via `app.useGlobalPipes` in `main.ts`
    - _Requirements: 1.3, 2.1, 2.2_
  - [x]* 4.3 Write property test for `ConversationsService` — Property 1 (response shape)
    - **Property 1: Conversation creation response includes all required fields**
    - Use `fc.option(fc.string({ minLength: 1 }))` to generate optional title inputs
    - Assert that every returned `ConversationDto` has a UUID `id`, a non-empty `title`, and a valid ISO-8601 `createdAt`
    - **Validates: Requirements 1.1, 1.3**
  - [x]* 4.4 Write property test for `ConversationsService` — Property 2 (DESC ordering)
    - **Property 2: Conversation list is ordered descending by creation time**
    - Use `fc.array(fc.record({ createdAt: fc.date() }), { minLength: 2 })` to generate conversation arrays
    - Assert `conversations[i].createdAt >= conversations[i+1].createdAt` for all `i`
    - **Validates: Requirements 2.2**

- [x] 5. Implement the Messages module in `apps/api`
  - [x] 5.1 Create `MessagesService`
    - Create `apps/api/src/messages/messages.service.ts`
    - Implement `getHistory(conversationId: string): Promise<MessageDto[]>` — query messages for conversation ordered `createdAt ASC`, throw `NotFoundException` if conversation doesn't exist
    - Implement `createUserMessage(conversationId: string, dto: CreateMessageDto): Promise<MessageDto>` — validate non-empty/non-whitespace content (throw `BadRequestException` on failure), throw `NotFoundException` if conversation doesn't exist, persist with `role: MessageRole.USER`, return saved entity as `MessageDto`
    - Implement `createAssistantMessage(conversationId: string, content: string): Promise<MessageDto>` — persist with `role: MessageRole.ASSISTANT`
    - _Requirements: 3.2, 3.5, 3.6, 4.4, 5.2, 5.5_
  - [x] 5.2 Create `MessagesController`
    - Create `apps/api/src/messages/messages.controller.ts`
    - `GET /conversations/:id/messages` → calls `MessagesService.getHistory()`, returns 200
    - `POST /conversations/:id/messages` → calls `MessagesService.createUserMessage()`, returns 201 with user `MessageDto`
    - _Requirements: 3.1, 5.1_
  - [x]* 5.3 Write property test for `MessagesService` — Property 3 (whitespace rejection)
    - **Property 3: Whitespace-only message content is always rejected**
    - Use `fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'))` to generate whitespace-only strings
    - Assert that `createUserMessage` always throws `BadRequestException` (HTTP 400) for any such input
    - **Validates: Requirements 3.5**
  - [x]* 5.4 Write property test for `MessagesService` — Property 4 (user message fields)
    - **Property 4: User message persistence includes all required fields**
    - Use `fc.string({ minLength: 1 })` filtered to non-whitespace-only strings
    - Assert persisted message has UUID `id`, correct `conversationId`, `role === 'user'`, exact `content`, and valid `createdAt`
    - **Validates: Requirements 3.2**
  - [x]* 5.5 Write property test for `MessagesService` — Property 9 (ASC ordering)
    - **Property 9: Message history is ordered ascending by creation time**
    - Use `fc.array(fc.record({ createdAt: fc.date() }), { minLength: 2 })` to generate message arrays
    - Assert `messages[i].createdAt <= messages[i+1].createdAt` for all `i`
    - **Validates: Requirements 5.2**

- [x] 6. Implement the SSE Events module in `apps/api`
  - [x] 6.1 Create `EventsService`
    - Create `apps/api/src/events/events.service.ts`
    - Maintain `private subjects = new Map<string, Subject<MessageDto>>()`
    - Implement `getOrCreate(conversationId: string): Subject<MessageDto>` — returns existing or creates new `Subject`
    - Implement `emit(conversationId: string, message: MessageDto): void` — pushes message to subject if it exists
    - Implement `cleanup(conversationId: string): void` — completes and deletes the subject from the map
    - _Requirements: 4.5_
  - [x] 6.2 Create `EventsController`
    - Create `apps/api/src/events/events.controller.ts`
    - `@Sse() GET /conversations/:id/events` — calls `EventsService.getOrCreate()`, returns an `Observable<MessageEvent>` piping `MessageDto` to `{ data: dto }`
    - Call `EventsService.cleanup()` when the client disconnects (use `@Res()` and `res.on('close', ...)`)
    - Set `Content-Type: text/event-stream` and `Cache-Control: no-cache` headers
    - _Requirements: 4.5, 4.6_

- [x] 7. Implement NATS integration in `apps/api`
  - [x] 7.1 Create `NatsClientModule`
    - Create `apps/api/src/nats/nats.module.ts`
    - Register `ClientsModule.registerAsync` using `NATS_SUBJECTS` from `libs/shared` and `NATS_URL` from env
    - Export the NATS client token so it can be injected into other services
    - _Requirements: 7.1, 7.3_
  - [x] 7.2 Create `NatsSubscriberService`
    - Create `apps/api/src/nats/nats-subscriber.service.ts`
    - On startup (`onModuleInit`), subscribe to `NATS_SUBJECTS.AI_RESPONSE` using the NATS client
    - On each `ai.response` event: call `MessagesService.createAssistantMessage()`, then call `EventsService.emit()` with the persisted `MessageDto`
    - Implement 30-second timeout logic: if `ai.response` is not received within 30 s after `ai.request` is published, persist a timeout message with content `"[AI service timed out]"` and emit it via SSE
    - Log each NATS connection retry on failure; do not log on successful connection
    - _Requirements: 4.4, 4.5, 4.7, 7.1, 7.5_
  - [x] 7.3 Wire NATS publish into `MessagesService`
    - Inject the NATS client into `MessagesService`
    - After persisting the user message, publish `AiRequestPayload { conversationId, content }` to `NATS_SUBJECTS.AI_REQUEST`
    - _Requirements: 3.3, 7.3_

- [x] 8. Implement the AI microservice (`apps/ai-service`)
  - [x] 8.1 Create `MockResponseGenerator`
    - Create `apps/ai-service/src/mock-response/mock-response.generator.ts`
    - Implement `generateMockResponse(input: string): string` with the three-step priority chain: (1) empty/whitespace guard → return `'Hello! How can I help you?'`; (2) keyword map case-insensitive scan → return associated fixed reply; (3) echo fallback → return `` `You said: "${input.trim()}"` ``
    - Define `KEYWORD_RESPONSES` map with at minimum: `hello`, `hi`, `help`, `bye`, `thanks`, `weather`, `joke`, `time`
    - The function must be pure (no side effects, no I/O, no randomness)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  - [x] 8.2 Create `AiService`
    - Create `apps/ai-service/src/ai/ai.service.ts`
    - Inject the NATS client
    - Implement `handleRequest(payload: AiRequestPayload): void` — calls `generateMockResponse(payload.content)`, publishes `AiResponsePayload { conversationId: payload.conversationId, content: response }` to `NATS_SUBJECTS.AI_RESPONSE`
    - _Requirements: 4.1, 4.3_
  - [x] 8.3 Create `AiController` and bootstrap the NATS microservice
    - Create `apps/ai-service/src/ai/ai.controller.ts` with `@MessagePattern(NATS_SUBJECTS.AI_REQUEST)` decorated handler that delegates to `AiService.handleRequest()`
    - Create `apps/ai-service/src/main.ts` that bootstraps the app as `NestFactory.createMicroservice(AppModule, { transport: Transport.NATS, options: { servers: [process.env.NATS_URL] } })`
    - Log each NATS connection retry on failure; do not log on successful connection
    - _Requirements: 4.1, 7.2, 7.6_
  - [x]* 8.4 Write property tests for `MockResponseGenerator` — Properties 6, 7, 8
    - **Property 6: Mock generator always produces a non-empty output**
    - Use `fc.string()` (including empty string); assert `generateMockResponse(s).length >= 1` for all `s`
    - **Property 7: Mock generator is deterministic**
    - Use `fc.string()`; assert `generateMockResponse(s) === generateMockResponse(s)` (two calls, same input)
    - **Property 8: Keyword matching always returns the associated fixed response**
    - Use `fc.constantFrom(...Object.keys(KEYWORD_RESPONSES))` combined with random surrounding text; assert the exact associated string is returned
    - **Validates: Requirements 4.2, 10.2, 10.3, 10.5**

- [ ] 9. Checkpoint — backend integration
  - Ensure all backend unit and property tests pass: `npm run test`
  - Verify `apps/api` and `apps/ai-service` compile without errors: `npm run build:api && npm run build:ai`
  - Ask the user if any clarifications or changes are needed before proceeding to the frontend.

- [x] 10. Set up the Next.js 14 frontend (`apps/frontend`)
  - [x] 10.1 Bootstrap Next.js 14 with Tailwind CSS and configure the API client
    - Scaffold `apps/frontend` with `create-next-app --typescript --tailwind --app`
    - Configure `next.config.js` to forward API requests (set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SSE_URL` from env)
    - Create `apps/frontend/lib/api-client.ts` with typed functions: `getConversations()`, `createConversation(title?)`, `getMessages(conversationId)`, `sendMessage(conversationId, content)` — all using `fetch` with `NEXT_PUBLIC_API_URL` as base
    - Create `.env.local.example` with `NEXT_PUBLIC_API_URL=http://localhost:3000` and `NEXT_PUBLIC_SSE_URL=http://localhost:3000`
    - _Requirements: 6.1, 6.5, 6.6_
  - [x] 10.2 Create the root layout and page
    - Create `apps/frontend/app/layout.tsx` with `<html>`, `<body>`, and a root-level `<div>` using Tailwind flex layout (`h-screen flex`)
    - Create `apps/frontend/app/page.tsx` as the default route, rendering the two-panel layout: `<Sidebar />` on the left and an empty `<ChatPanel />` placeholder on the right
    - _Requirements: 6.1_

- [x] 11. Implement Sidebar and ConversationList components
  - [x] 11.1 Create `useConversations` hook
    - Create `apps/frontend/hooks/useConversations.ts`
    - On mount, call `api-client.getConversations()` and store result in state
    - Expose `conversations`, `isLoading`, `error`, `createConversation(title?)`
    - `createConversation`: optimistically prepend a new entry to the list before the API call resolves; on API failure, remove the optimistic entry and surface an error
    - _Requirements: 1.5, 2.1, 2.4, 2.5_
  - [x] 11.2 Create `ConversationList` component
    - Create `apps/frontend/components/ConversationList.tsx`
    - Renders each `ConversationDto` as a clickable item showing at least `title`
    - Renders empty-state message (`"No conversations yet"`) when the list is empty
    - Accepts `onSelect(id: string)` prop; highlights the active conversation
    - Styled exclusively with Tailwind CSS utility classes
    - _Requirements: 2.3, 2.4, 5.1, 6.1, 6.5, 6.6_
  - [x] 11.3 Create `Sidebar` component
    - Create `apps/frontend/components/Sidebar.tsx`
    - Renders a "New Conversation" button at the top; on click calls `useConversations().createConversation()`
    - Renders `<ConversationList>` below the button
    - Displays an error notification banner when `useConversations().error` is set
    - _Requirements: 2.5, 6.2, 6.6_

- [x] 12. Implement ChatPanel and MessageList components
  - [x] 12.1 Create `useMessages` hook
    - Create `apps/frontend/hooks/useMessages.ts`
    - Accepts `conversationId: string | null`
    - On `conversationId` change, calls `api-client.getMessages(conversationId)` and stores in state
    - Exposes `messages`, `isLoading`, `error`
    - _Requirements: 5.1, 5.5, 5.6_
  - [x] 12.2 Create `MessageList` component
    - Create `apps/frontend/components/MessageList.tsx`
    - Renders each `MessageDto` with visual distinction for `role === 'user'` vs `role === 'assistant'` (e.g., different background colors / alignment via Tailwind)
    - Renders empty-state message (`"No messages yet. Start the conversation!"`) when list is empty
    - Uses `useEffect` + `ref.scrollIntoView()` to auto-scroll to the latest message whenever `messages` changes
    - Renders `<LoadingIndicator>` when `isLoading` is `true`
    - _Requirements: 4.6, 5.3, 5.4, 5.6, 6.4, 6.6_
  - [x] 12.3 Create `LoadingIndicator` component
    - Create `apps/frontend/components/LoadingIndicator.tsx`
    - Simple animated indicator (e.g., three pulsing dots) using Tailwind `animate-pulse` or `animate-bounce`
    - _Requirements: 6.4, 6.6_
  - [x] 12.4 Create `ChatPanel` component
    - Create `apps/frontend/components/ChatPanel.tsx`
    - Accepts `conversationId: string | null` prop
    - Composes `<MessageList>` (top, scrollable flex-1) and `<MessageInput>` (bottom, fixed)
    - Passes `conversationId` down to children
    - _Requirements: 6.1, 6.3_

- [x] 13. Implement MessageInput component and SSE hook
  - [x] 13.1 Create `useSSE` hook
    - Create `apps/frontend/hooks/useSSE.ts`
    - Accepts `conversationId: string | null`
    - Opens an `EventSource` to `${NEXT_PUBLIC_SSE_URL}/conversations/${conversationId}/events` when `conversationId` is non-null
    - Parses incoming `MessageEvent.data` as `MessageDto` and appends to a `messages` state array (or invokes an `onMessage` callback)
    - Closes and re-opens on `conversationId` change
    - On `EventSource` `error` / close, relies on the browser's built-in `EventSource` reconnect behavior
    - _Requirements: 4.6, 4.7_
  - [x] 13.2 Create `MessageInput` component
    - Create `apps/frontend/components/MessageInput.tsx`
    - Renders a `<textarea>` and a "Send" `<button>`
    - On submit: calls `api-client.sendMessage(conversationId, content)` and disables the input field immediately
    - Re-enables the input field when an assistant `MessageDto` is received via the `useSSE` hook or when an error occurs
    - Displays an inline error notification if `sendMessage` fails
    - Supports `Enter` key (without Shift) to submit
    - All styling via Tailwind CSS
    - _Requirements: 3.1, 3.4, 4.6, 6.3, 6.5, 6.6_
  - [x] 13.3 Wire `useSSE` into the conversation page
    - Update `apps/frontend/app/conversations/[id]/page.tsx` to use both `useMessages` and `useSSE`
    - Merge SSE-delivered assistant messages into the `messages` state displayed by `<MessageList>`
    - Pass `isWaitingForResponse` flag derived from `useSSE` state to `<MessageInput>` to drive disable/enable
    - _Requirements: 4.6, 5.1_

- [~] 14. Checkpoint — frontend integration
  - Ensure the frontend builds without type errors: run `next build` inside `apps/frontend`
  - Ensure all frontend unit tests pass: `npm run test`
  - Ask the user if any clarifications or changes are needed before proceeding to Docker.

- [x] 15. Write Dockerfiles for each application
  - [x] 15.1 Write `apps/api/Dockerfile`
    - Multi-stage build: `builder` stage installs all deps and runs `nest build api`; `runner` stage copies `dist/apps/api` and `node_modules` (prod only)
    - Expose port `3000`; `CMD ["node", "dist/apps/api/main"]`
    - Use `node:20-alpine` as base image
    - _Requirements: 9.1_
  - [x] 15.2 Write `apps/ai-service/Dockerfile`
    - Same multi-stage pattern as the API Dockerfile; builds `dist/apps/ai-service`
    - No exposed port (NATS microservice)
    - `CMD ["node", "dist/apps/ai-service/main"]`
    - _Requirements: 9.1_
  - [x] 15.3 Write `apps/frontend/Dockerfile`
    - Multi-stage build: `deps` stage installs deps; `builder` stage runs `next build`; `runner` stage uses `node:20-alpine` and copies `.next/standalone` + `public`
    - Expose port `3001`; `CMD ["node", "server.js"]`
    - Set `output: 'standalone'` in `next.config.js`
    - _Requirements: 9.1_

- [x] 16. Write `docker-compose.yml`
  - Define all five services: `postgres`, `nats`, `api`, `ai-service`, `frontend`
  - `postgres` service: `postgres:16-alpine`, healthcheck using `pg_isready`, named volume `postgres_data:/var/lib/postgresql/data`, `restart: unless-stopped`
  - `nats` service: `nats:2-alpine`, healthcheck using `/nats-server --help`, `restart: unless-stopped`
  - `api` service: `build: ./apps/api`, `depends_on: { postgres: { condition: service_healthy }, nats: { condition: service_healthy } }`, all env vars as placeholders, `ports: ["${API_PORT:-3000}:3000"]`, `restart: unless-stopped`
  - `ai-service` service: `build: ./apps/ai-service`, `depends_on: { nats: { condition: service_healthy } }`, `NATS_URL` env var, `restart: unless-stopped`
  - `frontend` service: `build: ./apps/frontend`, `depends_on: [api]`, `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SSE_URL` env vars, `ports: ["${FRONTEND_PORT:-3001}:3001"]`, `restart: unless-stopped`
  - Declare `volumes: { postgres_data: }` at the top level
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [~] 17. Final checkpoint — full stack
  - Run `docker compose build` to confirm all images build successfully
  - Ensure all unit and property tests pass: `npm run test`
  - Ensure all builds succeed: `npm run build:api && npm run build:ai`
  - Ask the user if any clarifications or changes are needed before closing the spec.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build
- Each task references specific requirements for traceability
- Checkpoints (tasks 9, 14, 17) are validation gates — ensure tests pass before moving on
- Property tests use **fast-check** and must run at minimum **100 iterations** per property
- Unit tests and property tests are complementary: unit tests cover examples and edge cases, property tests cover universal invariants
- The design document uses TypeScript/NestJS throughout; no language selection step is needed
- All frontend styling must use Tailwind CSS utility classes exclusively (Requirement 6.6)
- The `libs/shared` library is the single source of truth for DTOs, NATS subjects, and enums — import from there everywhere
- TypeORM migrations run automatically on API startup via `migrationsRun: true`

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2"] },
    { "id": 1, "tasks": ["3.1", "3.2"] },
    { "id": 2, "tasks": ["3.3"] },
    { "id": 3, "tasks": ["4.1", "5.1", "8.1"] },
    { "id": 4, "tasks": ["4.2", "5.2", "6.1", "8.2"] },
    { "id": 5, "tasks": ["4.3", "4.4", "5.3", "5.4", "5.5", "6.2", "8.3"] },
    { "id": 6, "tasks": ["7.1", "8.4"] },
    { "id": 7, "tasks": ["7.2", "7.3"] },
    { "id": 8, "tasks": ["10.1"] },
    { "id": 9, "tasks": ["10.2", "11.1", "15.1", "15.2"] },
    { "id": 10, "tasks": ["11.2", "12.1", "15.3"] },
    { "id": 11, "tasks": ["11.3", "12.2", "13.1"] },
    { "id": 12, "tasks": ["12.3", "13.2"] },
    { "id": 13, "tasks": ["12.4", "13.3"] }
  ]
}
```
