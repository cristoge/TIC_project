"""Applies the SQL files in backend/migrations in name order, each one exactly once."""

from pathlib import Path

import psycopg

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "migrations"


def apply_migrations(conninfo: str, migrations_dir: Path = MIGRATIONS_DIR) -> list[str]:
    """Apply pending migrations and return the names of the ones applied in this call.

    Each file runs in its own transaction together with its bookkeeping row,
    so a failing migration leaves no partial schema behind.
    """
    applied_now = []
    with psycopg.connect(conninfo) as conn:
        conn.execute(
            "create table if not exists schema_migrations ("
            " name text primary key,"
            " applied_at timestamptz not null default now())"
        )
        conn.commit()
        already_applied = {row[0] for row in conn.execute("select name from schema_migrations")}

        for path in sorted(migrations_dir.glob("*.sql")):
            if path.name in already_applied:
                continue
            with conn.transaction():
                conn.execute(path.read_text())
                conn.execute("insert into schema_migrations (name) values (%s)", (path.name,))
            applied_now.append(path.name)
    return applied_now
