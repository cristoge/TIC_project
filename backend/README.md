# Backend

Python backend for the AWS migration described in [`docs/aws-migration/README.md`](../docs/aws-migration/README.md).

## Quick path

```bash
docker compose up -d --wait db   # from the repository root: Postgres 17 + pgvector on localhost:5433
cd backend
uv sync                          # Python 3.13 + dependencies
uv run pytest                    # unit and integration tests
```

Integration tests create a throwaway database per test on the local Postgres and drop it afterwards. Point them at another server with `TEST_DATABASE_URL`.

## REST API

FastAPI app in `entrypoints/api/`. The full contract (bodies, status codes) is the OpenAPI document at `/docs` when running locally; request and response models live in `entrypoints/api/schemas.py`.

| Method | Path | Notes |
|--------|------|-------|
| GET, PATCH | `/me` | First request creates the user row from the token (`sub`, `email`) |
| GET, POST | `/projects` | |
| PATCH, DELETE | `/projects/{id}` | Delete also removes the documents' files in S3 |
| GET, POST | `/projects/{id}/documents` | POST `{name, size_bytes}` → pending document + presigned POST `{url, fields}`; PDF only, ≤ 25 MB, ≤ 20 per project (409) |
| GET, PATCH, DELETE | `/documents/{id}` | |
| GET, POST | `/documents/{id}/summaries` | POST → 202, queued; 409 if the document is not `ready` |
| GET, POST | `/documents/{id}/flashcard-decks` | POST `{count: 1-30, topic?}` → 202, queued |
| GET, POST | `/documents/{id}/quizzes` | POST `{count: 1-30, topic?}` → 202, queued |
| GET | `/summaries/{id}`, `/flashcard-decks/{id}`, `/quizzes/{id}` | Quiz questions never include the correct answer |
| POST | `/quizzes/{id}/attempts` | `{answers: {question_id: 0-3}}`, every question once → score and explanations (graded on the server) |
| GET, POST | `/projects/{id}/conversations` | The chat itself runs in AgentCore Runtime |
| GET | `/conversations/{id}/messages` | Messages with their sources (document, page) and created artifacts |
| DELETE | `/conversations/{id}` | |

Every resource is owner-scoped: another user's id answers 404, never 403.

**Authentication.** In AWS, API Gateway's Cognito authorizer validates the ID token and the Lambda reads its claims (`lambda_handler` in `entrypoints/api/main.py`). Locally:

```bash
export DATABASE_URL=postgresql://study:study@localhost:5433/study DOCUMENTS_BUCKET=... GENERATION_QUEUE_URL=...
export COGNITO_ISSUER=https://cognito-idp.eu-central-1.amazonaws.com/<pool-id> COGNITO_CLIENT_ID=<app-client-id>
uv run uvicorn entrypoints.api.main:local_app --factory --reload
```

## Chat agent

Strands agent (agentic RAG) served by AgentCore Runtime from `entrypoints/agent/app.py`.

- **Request**: `POST /invocations` with `{"conversation_id": "<uuid>", "message": "..."}` and the Cognito ID token in `Authorization: Bearer ...` (create the conversation first with `POST /projects/{id}/conversations`).
- **Response**: SSE stream of JSON events: `token` (text as it is generated), `sources` (only the passages cited as `[n]`, with document and page), `artifact` (`summary` / `flashcards` / `quiz` created in this turn, with its id), `end` (the saved message id), or a single `error` (`unauthenticated`, `invalid_request`, `not_found`, `internal`).
- **Tools**: `search_documents(query, document_ids?)`, `list_documents()`, `create_summary(document_id)`, `create_flashcards(document_id, count, topic?)`, `create_quiz(document_id, count, topic?)`. User and project come from the server-side request state, never from the model; any document id the model passes is checked against the project.
- **Model**: Nova 2 Lite, temperature 0.2, at most 6 turns per request (Strands `limits`).
- **History**: the newest messages of the conversation that fit in ~16,000 characters; only text and cited sources are stored, not tool calls.
- **Auth**: deployed, AgentCore's inbound JWT authorizer validates the token and `AUTH_VALIDATED_UPSTREAM=true` makes the agent read its claims; locally, set `COGNITO_ISSUER` and `COGNITO_CLIENT_ID` and run `uv run python -m entrypoints.agent.app` (serves `:8080`).

## Layout

| Path | Contents |
|------|----------|
| `migrations/` | Ordered SQL migrations (`0001_initial_schema.sql`, ...) |
| `domain/` | Plain data types (`Page`, `Chunk`) |
| `services/chunking.py` | Page-aware recursive splitter (~1100 chars, ~15 % overlap); each chunk keeps the page where it starts |
| `services/ingestion.py` | `IngestionService.ingest(document_id, s3_key)`: PDF → pages → chunks → embeddings → database. Idempotent; a PDF without text fails without retry, any other error is raised so SQS retries |
| `services/search.py` | `SearchService.search(project_id, query, document_ids=None)`: hybrid search (40 candidates) → reranker → top 8; falls back to the hybrid order if the reranker fails |
| `services/study.py` | `StudyService`: `create_summary/create_flashcards/create_quiz` (pending row) and `generate_*` (fill it), plus `grade_quiz`. Structured output, validation (duplicates, lengths, 4 distinct options, pages clamped), options shuffled on the server. Final failures (too long, topic not found, nothing valid) are recorded and not retried |
| `domain/study.py` | Pydantic models that are also the LLM output schemas (`Summary`, `FlashcardSet`, `Quiz`) and grading results |
| `adapters/bedrock/structured_llm.py` | `StrandsStructuredLLM`: one-shot structured output with Strands on Bedrock (Nova 2 Lite by default) |
| `adapters/postgres/study.py` | `PostgresStudyRepository` for summaries, decks, quizzes and attempts |
| `entrypoints/api/` | REST API: `app.py` (routes), `schemas.py` (contract), `auth.py` (Cognito claims / local JWT validation), `main.py` (wiring, Lambda handler via Mangum) |
| `services/chat.py` | `ChatService.chat(...)`: one turn (history → agent → stream → persist) and the event protocol |
| `services/agent_tools.py` | What the agent can do (search, list, create study artifacts) and `TurnRecorder` (citation numbers, artifacts) |
| `adapters/bedrock/agent_runner.py` | `StrandsAgentRunner`, the system prompt and the Strands tool wrappers |
| `adapters/postgres/conversations.py` | Conversation ownership, history within a character budget, saving a turn (messages, sources, artifacts, title) |
| `entrypoints/agent/` | `handler.py` (identity, payload validation, error events) and `app.py` (AgentCore wiring) |
| `adapters/postgres/catalog.py` | Owner-scoped queries for the REST API |
| `adapters/sqs/queue.py` | `SqsJobQueue`: queues study generation jobs |
| `entrypoints/generation/handler.py` | Lambda handler for study jobs `{"kind": "summary" \| "flashcards" \| "quiz", "id": ...}` delivered through SQS. Needs `DATABASE_URL` and `DOCUMENTS_BUCKET` |
| `evaluation/retrieval.py` | Retrieval metrics: first relevant rank, hit rate at k, mean reciprocal rank |
| `adapters/postgres/` | `apply_migrations(conninfo)`, `PostgresDocumentRepository`, `PostgresSearchIndex` (calls the `hybrid_search` SQL function; blank query text gives the pure semantic order) |
| `adapters/bedrock/embeddings.py` | `TitanEmbedder` (Titan Text Embeddings V2, 512 d, parallel calls) |
| `adapters/bedrock/rerank.py` | `BedrockReranker` (Bedrock Rerank API, Cohere Rerank 3.5 by default) |
| `adapters/s3/storage.py` | Reads uploaded PDFs; writes `documents/{id}/pages.json` |
| `adapters/pdf/pymupdf_reader.py` | Per-page text extraction with PyMuPDF |
| `entrypoints/ingest/handler.py` | Lambda handler for S3 upload notifications delivered through SQS (partial batch failures). Needs `DATABASE_URL` and `DOCUMENTS_BUCKET` |
| `tests/unit/` | Tests with fakes and botocore stubs; no network |
| `tests/integration/` | Tests against the local Postgres |
