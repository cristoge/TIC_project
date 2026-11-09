# AWS migration (Strands + AgentCore)

Objective: replace Supabase + LangGraph + Ollama with an all-AWS backend (Cognito, RDS + pgvector, S3, SQS, Lambda, Bedrock, AgentCore) and a Strands agentic RAG over projects with many documents. Detailed design: `docs/aws-migration/README.md`.
Branch: `migration` · Delivery strategy: ask-on-risk (chain strategy not chosen yet) · Test runner: `uv run pytest` in `backend/` (integration tests need `docker compose up -d db`).

## Specs

- **S1** — Everything on AWS, no Supabase: "la idea es cambiar usar strands y tenerlo todo en aws", "supabase no quiero usarlo me gustaria tenerlo todo en aws". Design: Cognito, RDS PostgreSQL + pgvector, private S3, SQS, Lambda, API Gateway, Bedrock, AgentCore Runtime, region `eu-central-1`.
- **S2** — Empty database, new schema: "vacia completamente". Schema, enums, triggers and `hybrid_search` exactly as in `docs/aws-migration/README.md` § Base de datos. Local development uses the same Postgres + pgvector engine and driver (`psycopg`) as AWS.
- **S3** — Project-level chat over many documents: "la idea es que sea un projecto con muchos documentos y puedas hablar ahi". Conversations belong to a project; answers cite document and page.
- **S4** — Hybrid search: "lo de la busqueda hibrida bm25". Postgres FTS (`spanish`, OR between terms) + pgvector, fused with RRF (k = 60, 40 candidates), Cohere Rerank 3.5 to the top 8, RRF order as fallback.
- **S5** — Ingestion: presigned POST to S3 → SQS (+ DLQ) → Lambda; page-aware chunking (~1000–1200 chars, ~15 % overlap), Titan Embeddings V2 (512 d), idempotent, per-page text saved to S3.
- **S6** — Study features: summary, flashcards and multiple-choice quiz ("si perfecto" to adding the quiz), structured output, persisted, available from REST (async) and from the agent (sync).
- **S7** — Users with Cognito and Lambdas: "si pero si quiero el tema usuarios y demas con cognito usar lambdas". `user_id` always comes from the token; user row created lazily.
- **S8** — Sampling control: "lo que si quiero es definir la temperatura topk top p". Model Amazon Nova 2 Lite (`eu.amazon.nova-2-lite-v1:0`); starting temperatures chat 0.2, summary 0.3, quiz 0.5, flashcards 0.7.
- **S9** — Remove simple chat: "si quita el envoltorio ese de chatsimple".
- **S10** — Portfolio lifecycle: "es un portfolio sencillo que usare durante 2 horas documentare y ya". Reproducible deploy/destroy with infrastructure as code (CDK or Terraform: undecided).
- **S11** — The Expo app is rewritten from scratch later: "todo la app con expo lo hare de 0 otra vez". Out of scope for the backend tasks.

## Tasks

| ID | Specs | Task | Route | Status | Evidence |
|----|-------|------|-------|--------|----------|
| T1 | S2, S4 | Local Postgres + pgvector (`docker compose`), schema migration, migration runner, integration tests for schema and `hybrid_search` | inline | done | `34bd758`; RED `ModuleNotFoundError: adapters`; GREEN 11 passed; review assess: medium, `under_budget` |
| T2 | S5 | Ingestion service: PDF → pages → chunks → embeddings | inline | done | `f60ef27`; RED 7 collection errors (modules missing); GREEN 37 passed; review assess: medium, `under_budget` |
| T3 | S4 | Search service: hybrid search + reranker + retrieval eval set | inline | pending | — |
| T4 | S6 | Summary, flashcards, quiz services (incl. grading) | inline | pending | — |
| T5 | S3, S6, S7 | API contract + REST API (FastAPI) | inline | pending | — |
| T6 | S3, S4, S8, S9 | Strands agent (tools, history, streaming, limits, system prompt) | inline | pending | — |
| T7 | S1, S7, S10 | Infrastructure as code (AuthStack + AppStack) | inline | pending | — |
| T8 | S10 | Test deployment + full evaluation | inline | pending | — |

## Log

- **L1** (2026-11-09, user request) — "hola analizame el proyecto un poco la idea es cambiar usar strands y tenerlo todo en aws que opinas, mas alla del codigo que esta muy mal hecho quiero ver que deberia cambiar antes las tecnologias y demas porque supabase no quiero usarlo me gustaria tenerlo todo en aws"
- **L2** (2026-11-09) — Design closed and documented in `docs/aws-migration/README.md` (commit `b9702c6`). User: "si dale" to start implementing with T1.
- **L3** (2026-11-09) — T1 started. Docker Desktop was not running; started it. Python 3.13 via `uv` for the backend (Lambda-compatible runtime).
- **L4** (2026-11-09) — T1 done in `34bd758`. `backend/migrations/0001_initial_schema.sql` is extracted verbatim from the plan's SQL block. Tests (S2, S4): full table set, idempotent re-run, `updated_at` and `touch_conversation` triggers, RRF ordering (lexical match lifts a chunk), document name/page/similarity columns, Spanish stemming (`células` → `célula`), OR between terms, stopword-only query, project and `ready` filters, candidate limit. Mutation check: replacing the OR query with `plainto_tsquery` (AND) fails `test_lexical_search_needs_only_one_of_the_query_terms`. Native review: `review_due=false` (`under_budget`), slice stays open. Next: T2 ingestion.
- **L5** (2026-11-09) — T2 done in `f60ef27` (S5). Own recursive splitter instead of `langchain-text-splitters` (avoids pulling `langchain-core`); pieces concatenate back to the exact text, so chunk start offsets map to pages. `IngestionService` with ports (repository, storage, PDF reader, embedder); a PDF without text is a final failure (no retry), other errors mark `failed` and re-raise for SQS. Adapters: Postgres repository (replace chunks + `ready` in one transaction), Titan V2 embedder (request shape verified against AWS docs and botocore stubs; parallel calls keep input order), S3 storage (`documents/{id}/pages.json`), PyMuPDF reader. Lambda handler with partial batch failures, URL-decoded keys, ignores `s3:TestEvent`. Not yet exercised against real AWS (T8). Open: chain strategy for PRs (running count > 400 lines). Next: T3 search service + reranker; the retrieval eval set needs the user's PDFs.
