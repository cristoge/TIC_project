"""Request handling for the chat agent, independent of AgentCore so it can be tested.

Payload: {"conversation_id": "<uuid>", "message": "..."}; the response is a stream of
the events described in services/chat.py, or a single error event:
  {"type": "error", "code": "unauthenticated" | "invalid_request" | "not_found" | "no_answer" | "internal", "message": "..."}
"""

import logging
import uuid
from collections.abc import AsyncIterator

import jwt

from entrypoints.api.auth import CurrentUser, InvalidToken, JwtVerifier
from services.chat import ConversationNotFound, InvalidChatRequest

logger = logging.getLogger(__name__)


def identify(headers: dict, verifier: JwtVerifier | None) -> CurrentUser | None:
    """The caller, from the Authorization header.

    Deployed, AgentCore Runtime's inbound JWT authorizer has already validated the
    token (signature, issuer, client) before the request reaches this code, and the
    runtime has no route to Cognito's keys, so the claims are read without checking
    the signature again (verifier=None). Locally there is no authorizer, so the
    token is fully verified.
    """
    scheme, _, token = (headers or {}).get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    try:
        if verifier is not None:
            return verifier.verify(token)
        claims = jwt.decode(token, options={"verify_signature": False})
        if claims.get("token_use") != "id":
            return None
        return CurrentUser(id=claims["sub"], email=claims["email"])
    except (InvalidToken, jwt.PyJWTError, KeyError):
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
