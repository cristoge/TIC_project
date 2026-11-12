# Backend

Python backend of the study app. It runs on the developer's machine; only the DeepSeek API and Cognito are remote.

## Quick path

```bash
docker compose up -d --wait db   # from the repository root: Postgres 17 + pgvector on localhost:5433
cd backend
uv sync                          # Python 3.13 + dependencies
uv run pytest                    # unit and integration tests
```

Integration tests create a throwaway database per test on the local Postgres and drop it afterwards. Point them at another server with `TEST_DATABASE_URL`.

## Run everything

Wiring lives in `entrypoints/local.py`:

| Piece | Implementation |
|-------|----------------|
| LLM | DeepSeek API |
| Embeddings | Ollama (`embeddinggemma-2:270m`, 512 d) |
| Reranker | none: hybrid (RRF) order |
| Files | `LOCAL_STORAGE_DIR` + `POST /local-uploads` (same form as an S3 presigned POST) |
| Generation jobs | background threads in the API process |
| Database | docker compose |
| Users | Cognito user pool (`infra/auth`) |

Embeddings from different models cannot be mixed: changing the embedding model means ingesting the documents again.

```bash
docker compose up -d --wait db                 # from the repository root
ollama pull embeddinggemma-2:270m              # once
cd backend
cp .env.local.example .env.local               # fill in DEEPSEEK_API_KEY and the Cognito values
set -a; source .env.local; set +a
uv run python -m scripts.migrate               # create the schema
uv run uvicorn entrypoints.api.main:local_app --factory --reload   # REST API on :8000
uv run python -m entrypoints.agent.app         # chat agent on :8080 (another terminal, same env)
# AGENT_HOST=0.0.0.0 makes the agent reachable from a phone or simulator (default 127.0.0.1)
```

Try it with a token from `uv run python -m scripts.get_token you@example.com` (see `infra/README.md`):

```bash
H="Authorization: Bearer $TOKEN"
P=$(curl -s -H "$H" -H 'Content-Type: application/json' -d '{"name":"TFE"}' localhost:8000/projects | jq -r .id)
R=$(curl -s -H "$H" -H 'Content-Type: application/json' -d '{"name":"paper.pdf","size_bytes":100000}' localhost:8000/projects/$P/documents)
curl -s -F "key=$(echo $R | jq -r .upload.fields.key)" -F "file=@../docs/paper_overleaf.pdf;type=application/pdf" localhost:8000/local-uploads
curl -s -H "$H" localhost:8000/documents/$(echo $R | jq -r .document.id)       # wait for "status": "ready"
C=$(curl -s -H "$H" -H 'Content-Type: application/json' -d '{}' localhost:8000/projects/$P/conversations | jq -r .id)
curl -N -H "$H" -H 'Content-Type: application/json' -d "{\"conversation_id\":\"$C\",\"message\":\"¿Qué base de datos se usa?\"}" localhost:8080/invocations
```

## REST API

FastAPI app in `entrypoints/api/`. The full contract (bodies, status codes) is the OpenAPI document at `/docs` when running locally; request and response models live in `entrypoints/api/schemas.py`.

| Method | Path | Notes |
|--------|------|-------|
| GET, PATCH | `/me` | First request creates the user row from the token (`sub`, `email`) |
| GET, POST | `/projects` | |
| PATCH, DELETE | `/projects/{id}` | Delete also removes the documents' files |
| GET, POST | `/projects/{id}/documents` | POST `{name, size_bytes}` → pending document + presigned POST `{url, fields}`; PDF only, ≤ 30 MB, ≤ 20 per project (409) |
| GET, PATCH, DELETE | `/documents/{id}` | |
| GET, POST | `/documents/{id}/summaries` | POST → 202, queued; 409 if the document is not `ready` |
| GET, POST | `/documents/{id}/flashcard-decks` | POST `{count: 1-30, topic?}` → 202, queued |
| GET, POST | `/documents/{id}/quizzes` | POST `{count: 1-30, topic?}` → 202, queued |
| GET | `/summaries/{id}`, `/flashcard-decks/{id}`, `/quizzes/{id}` | Quiz questions never include the correct answer. Decks carry `card_count` and quizzes `question_count`; the per-document lists leave `cards` and `questions` empty |
| PATCH, DELETE | `/flashcard-decks/{id}`, `/quizzes/{id}` | PATCH `{topic}` (blank or null clears it); DELETE also removes its cards or questions and attempts, and the chat message that created it keeps its text. `409` while it is still being generated |
| POST | `/quizzes/{id}/attempts` | `{answers: {question_id: 0-3}}`, every question once → score and explanations (graded on the server) |
| GET, POST | `/projects/{id}/conversations` | The chat itself runs in the agent server (`entrypoints/agent/app.py`) |
| GET | `/conversations/{id}/messages` | Messages with their sources (document, page) and created artifacts |
| PATCH | `/conversations/{id}` | Rename: `{title}`, trimmed, 1–200 characters |
| DELETE | `/conversations/{id}` | |

Every resource is owner-scoped: another user's id answers 404, never 403.

**Authentication.** The API validates the Cognito ID token itself with `COGNITO_ISSUER` and `COGNITO_CLIENT_ID` (see `.env.local.example`).

## Chat agent

Strands agent (agentic RAG) served by FastAPI from `entrypoints/agent/app.py` (`POST /invocations`, `GET /ping`).

- **Request**: `POST /invocations` with `{"conversation_id": "<uuid>", "message": "..."}` and the Cognito ID token in `Authorization: Bearer ...` (create the conversation first with `POST /projects/{id}/conversations`).
- **Response**: SSE stream of JSON events: `token` (text as it is generated, in limited Markdown: **bold** and short bullet lists only, so the app must render Markdown), `sources` (only the passages cited as `[n]`, with document and page), `artifact` (`summary` / `flashcards` / `quiz` created in this turn, with its id), `end` (the saved message id), or a single `error` (`unauthenticated`, `invalid_request`, `not_found`, `internal`). If the agent produced no text (e.g. the turn limit stopped a tool loop), `error` with code `no_answer` replaces `end` and nothing is saved.
- **Student's name**: the chat service reads `users.name` (set with `PATCH /me`) and the agent's instructions include it, so it can address the student and answer "what is my name"; without a name nothing is added.
- **Tools**: `search_documents(query, document_ids?)`, `list_documents()`, `create_summary(document_id)`, `create_flashcards(document_id, count, topic?)`, `create_quiz(document_id, count, topic?)`. User and project come from the server-side request state, never from the model; any document id the model passes is checked against the project.
- **Model**: `LLM_MODEL` (`deepseek/`, `ollama/`, `openai/` or `anthropic/` + model, see `.env.local.example`), temperature 0.2 (not sent to Claude, whose current models reject it), at most 6 turns per request (Strands `limits`).
- **History**: the newest messages of the conversation that fit in ~16,000 characters; only text and cited sources are stored, not tool calls.
- **Auth**: the agent validates the token itself with `COGNITO_ISSUER` and `COGNITO_CLIENT_ID`; run it with `uv run python -m entrypoints.agent.app` (serves `:8080`).

## Layout

| Path | Contents |
|------|----------|
| `migrations/` | Ordered SQL migrations (`0001_initial_schema.sql`, ...) |
| `domain/` | Plain data types (`Page`, `Chunk`) |
| `services/chunking.py` | Page-aware recursive splitter (~1100 chars, ~15 % overlap); each chunk keeps the page where it starts |
| `services/ingestion.py` | `IngestionService.ingest(document_id, s3_key)`: PDF → pages → chunks → embeddings → database. Idempotent; a PDF without text fails without retry, any other error is raised |
| `services/search.py` | `SearchService.search(project_id, query, document_ids=None)`: hybrid search (40 candidates) → optional reranker → top 8; falls back to the hybrid order if the reranker fails |
| `services/study.py` | `StudyService`: `create_summary/create_flashcards/create_quiz` (pending row) and `generate_*` (fill it), plus `grade_quiz`. Structured output, validation (duplicates, lengths, 4 distinct options, pages clamped), options shuffled on the server. Final failures (too long, topic not found, nothing valid) are recorded and not retried |
| `domain/study.py` | Pydantic models that are also the LLM output schemas (`Summary`, `FlashcardSet`, `Quiz`) and grading results |
| `adapters/bedrock/structured_llm.py` | `StrandsStructuredLLM`: one-shot structured output with Strands (DeepSeek through `adapters/llm_models.py`) |
| `adapters/postgres/study.py` | `PostgresStudyRepository` for summaries, decks, quizzes and attempts |
| `entrypoints/api/` | REST API: `app.py` (routes), `schemas.py` (contract), `auth.py` (Cognito JWT validation), `main.py` (`local_app` factory for uvicorn) |
| `services/chat.py` | `ChatService.chat(...)`: one turn (history → agent → stream → persist) and the event protocol |
| `services/agent_tools.py` | What the agent can do (search, list, create study artifacts) and `TurnRecorder` (citation numbers, artifacts) |
| `adapters/bedrock/agent_runner.py` | `StrandsAgentRunner`, the system prompt and the Strands tool wrappers |
| `adapters/postgres/conversations.py` | Conversation ownership, history within a character budget, saving a turn (messages, sources, artifacts, title) |
| `entrypoints/agent/` | `handler.py` (identity, payload validation, error events) and `app.py` (agent server) |
| `adapters/postgres/catalog.py` | Owner-scoped queries for the REST API |
| `evaluation/retrieval.py` | Retrieval metrics: first relevant rank, hit rate at k, mean reciprocal rank |
| `adapters/postgres/` | `apply_migrations(conninfo)`, `PostgresDocumentRepository`, `PostgresSearchIndex` (calls the `hybrid_search` SQL function; blank query text gives the pure semantic order) |
| `adapters/local/storage.py` | Stores uploaded PDFs and `documents/{id}/pages.json` under `LOCAL_STORAGE_DIR` |
| `adapters/pdf/pymupdf_reader.py` | Per-page text extraction with PyMuPDF |
| `tests/unit/` | Tests with fakes and botocore stubs; no network |
| `tests/integration/` | Tests against the local Postgres |
