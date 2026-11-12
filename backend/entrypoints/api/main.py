"""Builds the API: `uv run uvicorn entrypoints.api.main:local_app --factory --reload`.

COGNITO_ISSUER and COGNITO_CLIENT_ID must be set so ID tokens are validated here
(see entrypoints/local.py for the rest of the environment).
"""

from entrypoints.local import local_api_app


def local_app():
    """Run on the developer's machine: nothing but DeepSeek and Cognito is remote."""
    return local_api_app()
