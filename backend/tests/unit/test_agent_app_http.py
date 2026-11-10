"""Verifier probes: the AgentCore app over HTTP and the identity defaults (no AWS)."""

import json
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from starlette.testclient import TestClient

import entrypoints.agent.app as agent_app
from entrypoints.agent.handler import identify
from entrypoints.api.auth import CurrentUser, JwtVerifier

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
ISSUER, CLIENT = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_T", "client"
CONVERSATION = "00000000-0000-0000-0000-0000000000c1"


def _token(key=KEY, **overrides):
    claims = {"sub": "u1", "email": "a@example.com", "iss": ISSUER, "aud": CLIENT, "token_use": "id",
              "exp": int(time.time()) + 300}
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, key, algorithm="RS256")


class Jwks:
    def get_signing_key_from_jwt(self, token):
        class Key:
            key = KEY.public_key()
        return Key()


class FakeChat:
    def __init__(self):
        self.calls = []

    async def chat(self, user_id, conversation_id, message):
        self.calls.append((user_id, conversation_id, message))
        yield {"type": "token", "data": "Hola"}
        yield {"type": "end", "message_id": "m1"}


@pytest.fixture
def client(monkeypatch):
    chat = FakeChat()
    verifier = JwtVerifier(ISSUER, CLIENT, jwks_client=Jwks())
    monkeypatch.setattr(agent_app, "_chat_and_verifier", lambda: (chat, verifier))
    return TestClient(agent_app.app), chat


def _events(response):
    out = []
    for line in response.text.splitlines():
        if line.startswith("data: "):
            out.append(json.loads(line[6:]))
    return out


def test_http_payload_cannot_choose_the_user_and_header_case_does_not_matter(client):
    http, chat = client
    response = http.post(
        "/invocations",
        json={"conversation_id": CONVERSATION, "message": "Hola", "user_id": "attacker", "project_id": "p-other"},
        headers={"authorization": f"bearer {_token()}"},
    )
    assert response.status_code == 200
    assert _events(response)[-1] == {"type": "end", "message_id": "m1"}
    assert chat.calls == [("u1", CONVERSATION, "Hola")]


@pytest.mark.parametrize("headers", [
    {},
    {"Authorization": "Bearer garbage"},
    {"Authorization": f"Basic {_token()}"},
    {"Authorization": f"Bearer {_token(token_use='access')}"},
    {"Authorization": f"Bearer {_token(exp=int(time.time()) - 10)}"},
    {"Authorization": f"Bearer {_token(key=rsa.generate_private_key(public_exponent=65537, key_size=2048))}"},
    {"X-User-Id": "u1"},
])
def test_http_unauthenticated_requests_never_run_the_chat(client, headers):
    http, chat = client
    response = http.post("/invocations", json={"conversation_id": CONVERSATION, "message": "Hola"}, headers=headers)
    assert _events(response) == [{"type": "error", "code": "unauthenticated", "message": "Not authenticated."}]
    assert chat.calls == []


def _build(monkeypatch, **env):
    for name in ("AUTH_VALIDATED_UPSTREAM", "COGNITO_ISSUER", "COGNITO_CLIENT_ID"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql://x@localhost/none")
    monkeypatch.setenv("DOCUMENTS_BUCKET", "b")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "eu-central-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "x")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "x")
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    agent_app._chat_and_verifier.cache_clear()
    try:
        return agent_app._chat_and_verifier()
    finally:
        agent_app._chat_and_verifier.cache_clear()


def test_verification_is_the_default_and_fails_closed_without_cognito_settings(monkeypatch):
    with pytest.raises(KeyError):
        _build(monkeypatch)
    with pytest.raises(KeyError):
        _build(monkeypatch, AUTH_VALIDATED_UPSTREAM="TRUE")
    _, verifier = _build(monkeypatch, COGNITO_ISSUER=ISSUER, COGNITO_CLIENT_ID=CLIENT)
    assert isinstance(verifier, JwtVerifier)
    _, verifier = _build(monkeypatch, AUTH_VALIDATED_UPSTREAM="true")
    assert verifier is None


@pytest.mark.parametrize("claims", [
    {"sub": "u1", "email": "a@example.com", "token_use": "access"},
    {"sub": "u1", "email": "a@example.com"},
    {"email": "a@example.com", "token_use": "id"},
    {"sub": "u1", "token_use": "id"},
])
def test_upstream_mode_rejects_non_id_or_incomplete_tokens(claims):
    assert identify({"Authorization": f"Bearer {jwt.encode(claims, KEY, algorithm='RS256')}"}, None) is None


def test_upstream_mode_uses_only_the_token_claims():
    token = jwt.encode({"sub": "u1", "email": "a@example.com", "token_use": "id"}, KEY, algorithm="RS256")
    assert identify({"Authorization": f"Bearer {token}", "X-User-Id": "evil"}, None) == CurrentUser("u1", "a@example.com")
