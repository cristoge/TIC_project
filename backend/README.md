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
