"""The agent server over HTTP: authentication, payload handling and the event stream."""

import json
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from starlette.testclient import TestClient

import entrypoints.agent.app as agent_app
from entrypoints.api.auth import JwtVerifier

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


def test_ping_answers_healthy():
    response = TestClient(agent_app.app).get("/ping")

    assert response.status_code == 200
    assert response.json()["status"] == "Healthy"


def test_invalid_json_is_rejected_before_the_chat_runs(client):
    http, chat = client
    response = http.post(
        "/invocations", content=b"{not json", headers={"Authorization": f"Bearer {_token()}", "Content-Type": "application/json"}
    )

    assert response.status_code == 400
    assert chat.calls == []


def test_events_are_sent_as_server_sent_events_with_unicode_kept(client):
    http, _ = client
    response = http.post(
        "/invocations",
        json={"conversation_id": CONVERSATION, "message": "Hola"},
        headers={"Authorization": f"Bearer {_token()}"},
    )

    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.text == 'data: {"type": "token", "data": "Hola"}\n\ndata: {"type": "end", "message_id": "m1"}\n\n'
