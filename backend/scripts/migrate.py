"""Apply pending SQL migrations to DATABASE_URL.

    uv run python -m scripts.migrate
"""

import os
import sys

from adapters.postgres.migrations import apply_migrations


def main() -> int:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("Set DATABASE_URL (local: postgresql://study:study@localhost:5433/study).", file=sys.stderr)
        return 2
    applied = apply_migrations(database_url)
    print("Applied: " + ", ".join(applied) if applied else "Nothing to apply.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
