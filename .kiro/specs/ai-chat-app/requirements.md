# Requirements Document

## Introduction

This document defines the requirements for a full-stack AI chat application modeled after modern conversational AI interfaces (similar to ChatGPT). The system is built as a NestJS monorepo containing a main REST API, an AI microservice, and a Next.js frontend. Services communicate via NATS message broker. All components are containerized using Docker and Docker Compose. The AI microservice returns mock/deterministic responses — no real LLM integration is required.

Users can create conversations, send messages, receive AI-generated responses, and browse conversation history through a clean, responsive UI styled with Tailwind CSS.

---

## Glossary

- **Chat_App**: The overall full-stack AI chat application described in this document.
- **Frontend**: The Next.js + React.js web application served to the user's browser, styled with Tailwind CSS.
- **API_Server**: The NestJS application responsible for handling HTTP requests from the Frontend, persisting data to PostgreSQL, and publishing/subscribing to NATS topics.
- **AI_Service**: The NestJS microservice that listens on NATS, generates mock/deterministic AI responses, and publishes responses back via NATS.
- **NATS_Broker**: The NATS message broker that facilitates asynchronous communication between the API_Server and the AI_Service.
- **Database**: The PostgreSQL relational database used by the API_Server to persist conversations and messages.
- **Conversation**: A named session that groups a sequence of messages between a user and the AI.
- **Message**: A single unit of communication within a Conversation, attributed to either a "user" or an "assistant" role.
- **Conversation_List**: The ordered list of all Conversations belonging to the application, displayed in the sidebar of the Frontend.
- **Message_History**: The ordered sequence of Messages within a specific Conversation, displayed in the chat view.
- **Mock_Response_Generator**: The component within the AI_Service that deterministically produces a response string given an input message.

---

## Requirements

### Requirement 1: Create a Conversation

**User Story:** As a user, I want to create a new conversation, so that I can start a fresh chat session with the AI.

#### Acceptance Criteria

1. WHEN the user submits a request to create a new conversation, THE API_Server SHALL create a Conversation record in the Database with a unique identifier, a title, and a creation timestamp.
2. WHEN a new conversation is created without an explicit title, THE API_Server SHALL assign a default title (e.g., "New Conversation") to the Conversation.
3. WHEN the Conversation is successfully created, THE API_Server SHALL return the created Conversation object including its unique identifier and title to the Frontend.
4. IF the Database is unavailable when a create-conversation request is received, THEN THE API_Server SHALL return an error response with HTTP status 503.
5. WHEN the user submits a create-conversation request, THE Frontend SHALL optimistically display the new Conversation in the Conversation_List immediately, before backend confirmation is received.

---

### Requirement 2: View Conversation List

**User Story:** As a user, I want to view a list of all my conversations, so that I can navigate between chat sessions.

#### Acceptance Criteria

1. WHEN the Frontend loads, THE Frontend SHALL request the list of all Conversations from the API_Server.
2. THE API_Server SHALL return all Conversations ordered by creation timestamp in descending order (most recent first).
3. WHEN at least one Conversation exists, THE Frontend SHALL render each Conversation in the Conversation_List with at least its title visible.
4. WHEN no Conversations exist, THE Frontend SHALL display an empty state message immediately, bypassing Conversation_List rendering.
5. IF the API_Server returns an error when fetching the Conversation_List, THEN THE Frontend SHALL display an error notification to the user.

---

### Requirement 3: Send a Message

**User Story:** As a user, I want to send a message within a conversation, so that I can interact with the AI.

#### Acceptance Criteria

1. WHEN the user submits a message in an active Conversation, THE Frontend SHALL send the message content and the Conversation identifier to the API_Server.
2. WHEN the API_Server receives a send-message request, THE API_Server SHALL persist the user Message to the Database with the role "user", the message content, a unique identifier, and a creation timestamp.
3. WHEN the user Message is persisted, THE API_Server SHALL publish the message content and Conversation identifier to the NATS_Broker on a designated topic for the AI_Service.
4. THE Frontend SHALL disable the message input field after submission and keep it disabled until an AI response is received or an error occurs; the input remains disabled indefinitely if neither condition is met.
5. IF the message content submitted by the user is empty or contains only whitespace, THEN THE API_Server SHALL return an error response with HTTP status 400.
6. IF the Conversation identifier provided in the send-message request does not correspond to an existing Conversation, THEN THE API_Server SHALL return an error response with HTTP status 404.

---

### Requirement 4: Receive AI-Generated Response

**User Story:** As a user, I want to receive a response from the AI after sending a message, so that I can have a conversational exchange.

#### Acceptance Criteria

1. WHEN the AI_Service receives a message event from the NATS_Broker, THE AI_Service SHALL invoke the Mock_Response_Generator to produce a deterministic response string.
2. THE Mock_Response_Generator SHALL produce a non-empty response string for any non-empty input string.
3. WHEN the Mock_Response_Generator produces a response, THE AI_Service SHALL publish the response string and the Conversation identifier back to the NATS_Broker on a designated reply topic.
4. WHEN the API_Server receives the AI response from the NATS_Broker, THE API_Server SHALL persist the response as a Message in the Database with the role "assistant", the response content, a unique identifier, and a creation timestamp.
5. WHEN the assistant Message is persisted, THE API_Server SHALL deliver the assistant Message to the Frontend.
6. WHEN the assistant Message is delivered, THE Frontend SHALL append the assistant Message to the Message_History and re-enable the message input field.
7. IF the AI_Service does not respond within 30 seconds of the message being published to the NATS_Broker, THEN THE API_Server SHALL persist an error Message with the role "assistant" and content indicating a timeout, and SHALL deliver this error Message to the Frontend.

---

### Requirement 5: View Conversation History

**User Story:** As a user, I want to view the message history of a conversation, so that I can review prior exchanges.

#### Acceptance Criteria

1. WHEN the user selects a Conversation from the Conversation_List, THE Frontend SHALL request the Message_History for that Conversation from the API_Server.
2. THE API_Server SHALL return all Messages for the requested Conversation ordered by creation timestamp in ascending order (oldest first).
3. THE Frontend SHALL render each Message in the Message_History with the message content and a visual distinction between "user" and "assistant" roles.
4. WHEN the Message_History contains more than the visible viewport height of messages, THE Frontend SHALL scroll to the most recent message automatically.
5. IF the Conversation identifier provided in the message-history request does not correspond to an existing Conversation, or the Conversation is not accessible, THEN THE API_Server SHALL return an error response with HTTP status 404.
6. WHEN no Messages exist for a Conversation, THE Frontend SHALL display an empty state indicating no messages have been sent yet.

---

### Requirement 6: Frontend Chat Interface

**User Story:** As a user, I want a clean, responsive chat interface, so that I can comfortably use the application on any screen size.

#### Acceptance Criteria

1. THE Frontend SHALL render a two-panel layout consisting of a sidebar displaying the Conversation_List and a main panel displaying the active Message_History and message input.
2. THE Frontend SHALL provide a button or control in the sidebar to create a new Conversation.
3. THE Frontend SHALL provide a text input and a submit control in the main panel for composing and sending Messages.
4. WHILE an AI response is pending, THE Frontend SHALL display a loading indicator in the Message_History.
5. THE Frontend SHALL be responsive and render correctly on viewport widths of 375px and above.
6. THE Frontend SHALL use Tailwind CSS utility classes exclusively for all layout and styling.

---

### Requirement 7: Service Communication via NATS

**User Story:** As a developer, I want all inter-service communication to use NATS, so that the API_Server and AI_Service are decoupled.

#### Acceptance Criteria

1. THE API_Server SHALL connect to the NATS_Broker on startup using a configurable host and port.
2. THE AI_Service SHALL connect to the NATS_Broker on startup using a configurable host and port.
3. WHEN the API_Server publishes a message event, THE API_Server SHALL use a defined NATS subject string for outbound AI requests.
4. WHEN the AI_Service publishes a response event, THE AI_Service SHALL use a defined NATS subject string for outbound AI responses.
5. IF the NATS_Broker is unavailable when the API_Server starts, THEN THE API_Server SHALL log each connection failure and retry the connection; successful connections SHALL NOT generate a log entry.
6. IF the NATS_Broker is unavailable when the AI_Service starts, THEN THE AI_Service SHALL log each connection failure and retry the connection; successful connections SHALL NOT generate a log entry.

---

### Requirement 8: Data Persistence

**User Story:** As a developer, I want all conversations and messages persisted in PostgreSQL, so that data survives service restarts.

#### Acceptance Criteria

1. THE Database SHALL store each Conversation with at minimum: a unique identifier (UUID), a title (string), and a creation timestamp.
2. THE Database SHALL store each Message with at minimum: a unique identifier (UUID), the parent Conversation identifier (foreign key), a role ("user" or "assistant"), message content (text), and a creation timestamp.
3. THE API_Server SHALL use an ORM or query builder to interact with the Database, with all table schemas defined via migrations.
4. WHEN the API_Server has started and a database connection check fails on first attempt, THE API_Server SHALL log the connection error and exit with a non-zero status code without retrying.
5. THE Database SHALL enforce a foreign key constraint ensuring each Message references an existing Conversation.

---

### Requirement 9: Containerization

**User Story:** As a developer, I want all services containerized with Docker Compose, so that the entire stack can be started with a single command.

#### Acceptance Criteria

1. THE Chat_App SHALL provide a `docker-compose.yml` file that defines services for: the Frontend, the API_Server, the AI_Service, the NATS_Broker, and the Database.
2. WHEN `docker compose up` is executed, THE Chat_App SHALL start all five services and make the Frontend accessible on a defined host port.
3. THE `docker-compose.yml` SHALL define a named Docker volume for the Database to persist data across container restarts.
4. THE `docker-compose.yml` SHALL configure service dependencies so that the API_Server and AI_Service are blocked from starting until the NATS_Broker and Database containers report healthy status, after which they may start immediately.
5. THE `docker-compose.yml` SHALL expose environment variable placeholders for all configurable values including database credentials, NATS connection strings, and service ports.
6. WHEN any service container exits unexpectedly, THE `docker-compose.yml` restart policy SHALL cause the container to restart automatically.

---

### Requirement 10: Mock AI Response Generation

**User Story:** As a developer, I want the AI microservice to return deterministic mock responses, so that the system is testable without a real LLM.

#### Acceptance Criteria

1. THE Mock_Response_Generator SHALL produce a response string that is derived from the input message content (e.g., echoes the input, reverses it, or selects from a fixed response set).
2. THE Mock_Response_Generator SHALL produce a non-empty response string for any input string, including empty input strings (round-trip property: any input produces output).
3. THE Mock_Response_Generator SHALL produce the same response for the same input message on every invocation (deterministic property).
4. THE AI_Service SHALL not make any outbound HTTP requests to external LLM APIs.
5. WHERE the input message content matches a predefined keyword, THE Mock_Response_Generator SHALL return a fixed, predefined response string associated with that keyword.
