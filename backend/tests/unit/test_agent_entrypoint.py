import asyncio
import time

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

from entrypoints.agent.handler import identify, run_chat
from entrypoints.api.auth import CurrentUser, JwtVerifier
from services.chat import ConversationNotFound, InvalidChatRequest

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
ISSUER, CLIENT = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_T", "client"
CONVERSATION = "00000000-0000-0000-0000-0000000000c1"


def _token(**overrides):
    claims = {"sub": "u1", "email": "a@example.com", "iss": ISSUER, "aud": CLIENT, "token_use": "id",
              "exp": int(time.time()) + 300}
    claims.update(overrides)
    return jwt.encode(claims, KEY, algorithm="RS256")


class Jwks:
    def get_signing_key_from_jwt(self, token):
        class Key:
            key = KEY.public_key()

        return Key()


class FakeChat:
    def __init__(self, error=None):
        self.error = error
        self.calls = []

    async def chat(self, user_id, conversation_id, message):
        self.calls.append((user_id, conversation_id, message))
        if self.error:
            raise self.error
        yield {"type": "token", "data": "Hola"}
        yield {"type": "end", "message_id": "m1"}


def _run(chat, user, payload):
    async def collect():
        return [event async for event in run_chat(chat, user, payload)]

    return asyncio.run(collect())


USER = CurrentUser(id="u1", email="a@example.com")


def test_valid_payload_streams_the_chat_events():
    chat = FakeChat()

    events = _run(chat, USER, {"conversation_id": CONVERSATION, "message": "Hola"})

    assert events == [{"type": "token", "data": "Hola"}, {"type": "end", "message_id": "m1"}]
    assert chat.calls == [("u1", CONVERSATION, "Hola")]


def test_invalid_payload_gives_an_error_event_without_running_the_chat():
    chat = FakeChat()

    for payload in ({}, {"conversation_id": "not-a-uuid", "message": "x"}, {"conversation_id": CONVERSATION}):
        assert _run(chat, USER, payload) == [{"type": "error", "code": "invalid_request", "message": "Invalid request."}]
    assert chat.calls == []


def test_unauthenticated_request_gives_an_error_event():
    assert _run(FakeChat(), None, {"conversation_id": CONVERSATION, "message": "x"}) == [
        {"type": "error", "code": "unauthenticated", "message": "Not authenticated."}
    ]


def test_service_errors_become_error_events():
    assert _run(FakeChat(ConversationNotFound()), USER, {"conversation_id": CONVERSATION, "message": "x"}) == [
        {"type": "error", "code": "not_found", "message": "Conversation not found."}
    ]
    assert _run(FakeChat(InvalidChatRequest("The message is empty.")), USER, {"conversation_id": CONVERSATION, "message": " "}) == [
        {"type": "error", "code": "invalid_request", "message": "The message is empty."}
    ]
    # Any other ValueError is internal: its text must not reach the client.
    assert _run(FakeChat(ValueError("psycopg detail")), USER, {"conversation_id": CONVERSATION, "message": "x"}) == [
        {"type": "error", "code": "internal", "message": "Something went wrong. Please try again."}
    ]
    assert _run(FakeChat(RuntimeError("Bedrock down")), USER, {"conversation_id": CONVERSATION, "message": "x"}) == [
        {"type": "error", "code": "internal", "message": "Something went wrong. Please try again."}
    ]


def test_identify_verifies_the_token_locally():
    verifier = JwtVerifier(ISSUER, CLIENT, jwks_client=Jwks())

    assert identify({"Authorization": f"Bearer {_token()}"}, verifier) == USER
    assert identify({"Authorization": f"Bearer {_token(aud='other')}"}, verifier) is None
    assert identify({}, verifier) is None


def test_identify_never_trusts_a_token_it_cannot_verify():
    verifier = JwtVerifier(ISSUER, CLIENT, jwks_client=Jwks())
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    claims = {"sub": "u1", "email": "a@example.com", "iss": ISSUER, "aud": CLIENT, "token_use": "id",
              "exp": int(time.time()) + 300}

    assert identify({"Authorization": f"Bearer {jwt.encode(claims, other_key, algorithm='RS256')}"}, verifier) is None
    assert identify({"Authorization": "Bearer garbage"}, verifier) is None
