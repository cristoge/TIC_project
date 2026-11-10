"""Write the API's OpenAPI schema to a file, for the mobile app's generated types.

    uv run python -m scripts.export_openapi ../mobile/src/shared/api/openapi.json

No database, bucket or queue is needed: the routes only touch the container when a request arrives.
"""

import argparse
import json
import sys
from pathlib import Path

from entrypoints.api.app import Container, create_app


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("output", type=Path)
    args = parser.parse_args(argv)

    unused = None  # the schema is built from the route signatures only
    app = create_app(Container(catalog=unused, study=unused, storage=unused, queue=unused))  # type: ignore[arg-type]
    args.output.write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
