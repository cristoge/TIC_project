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
| `adapters/postgres/migrations.py` | `apply_migrations(conninfo)`: applies pending files once each, tracked in `schema_migrations` |
| `tests/integration/` | Tests against the local Postgres |
