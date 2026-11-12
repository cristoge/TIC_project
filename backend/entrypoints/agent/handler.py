"""Request handling for the chat agent, independent of the HTTP server so it can be tested.

Payload: {"conversation_id": "<uuid>", "message": "..."}; the response is a stream of
the events described in services/chat.py, or a single error event:
  {"type": "error", "code": "unauthenticated" | "invalid_request" | "not_found" | "no_answer" | "internal", "message": "..."}
"""

import logging
import uuid
from collections.abc import AsyncIterator, Mapping

from entrypoints.api.auth import CurrentUser, InvalidToken, JwtVerifier
from services.chat import ConversationNotFound, InvalidChatRequest

logger = logging.getLogger(__name__)


def identify(headers: Mapping[str, str], verifier: JwtVerifier) -> CurrentUser | None:
    """The caller, from the Authorization header; the Cognito ID token is always fully verified."""
    scheme, _, token = (headers or {}).get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    try:
        return verifier.verify(token)
    except InvalidToken:
        return None


def _error(code: str, message: str) -> dict:
    return {"type": "error", "code": code, "message": message}


async def run_chat(chat, user: CurrentUser | None, payload: dict) -> AsyncIterator[dict]:
    if user is None:
        yield _error("unauthenticated", "Not authenticated.")
        return
    try:
        conversation_id = str(uuid.UUID(str(payload["conversation_id"])))
        message = payload["message"]
        if not isinstance(message, str):
            raise TypeError
    except (KeyError, ValueError, TypeError):
        yield _error("invalid_request", "Invalid request.")
        return

    try:
        async for event in chat.chat(user.id, conversation_id, message):
            yield event
    except ConversationNotFound:
        yield _error("not_found", "Conversation not found.")
    except InvalidChatRequest as error:
        yield _error("invalid_request", str(error))
    except Exception:
        logger.exception("Chat turn failed for conversation %s", conversation_id)
        yield _error("internal", "Something went wrong. Please try again.")
