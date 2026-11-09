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
| `adapters/postgres/` | `apply_migrations(conninfo)` and `PostgresDocumentRepository` |
| `adapters/bedrock/embeddings.py` | `TitanEmbedder` (Titan Text Embeddings V2, 512 d, parallel calls) |
| `adapters/s3/storage.py` | Reads uploaded PDFs; writes `documents/{id}/pages.json` |
| `adapters/pdf/pymupdf_reader.py` | Per-page text extraction with PyMuPDF |
| `entrypoints/ingest/handler.py` | Lambda handler for S3 upload notifications delivered through SQS (partial batch failures). Needs `DATABASE_URL` and `DOCUMENTS_BUCKET` |
| `tests/unit/` | Tests with fakes and botocore stubs; no network |
| `tests/integration/` | Tests against the local Postgres |
