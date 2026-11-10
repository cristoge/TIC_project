"""Owner scoping on every endpoint, rejected requests change nothing, and local token validation end to end."""

import hashlib
import time

import jwt
import psycopg
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from adapters.postgres.catalog import PostgresCatalog
from entrypoints.api.app import Container, create_app
from entrypoints.api.auth import JwtVerifier
from tests.integration.test_api import BOB, _document, _mark_ready, _project, _ready_quiz, api  # noqa: F401


def _fingerprint(conninfo):
    with psycopg.connect(conninfo) as conn:
        tables = [
            r[0]
            for r in conn.execute(
                "select table_name from information_schema.tables where table_schema = 'public' order by 1"
            ).fetchall()
        ]
        digest = hashlib.sha256()
        for table in tables:
            digest.update(table.encode())
            for (row,) in conn.execute(f"select md5(t::text) from {table} t order by 1").fetchall():
                digest.update(row.encode())
        return digest.hexdigest()


def test_every_endpoint_answers_404_for_another_users_resource_and_changes_nothing(api, conn):
    project_id = _project(api)
    document_id = _document(api, project_id)["document"]["id"]
    _mark_ready(conn, document_id)
    summary_id = api.client.post(f"/documents/{document_id}/summaries").json()["id"]
    deck_id = api.client.post(f"/documents/{document_id}/flashcard-decks", json={"count": 1}).json()["id"]
    quiz_id = _ready_quiz(api, conn)
    conversation_id = api.client.post(f"/projects/{project_id}/conversations", json={}).json()["id"]
    questions = api.client.get(f"/quizzes/{quiz_id}").json()["questions"]
    api.as_user(BOB)
    api.client.get("/me")
    jobs, deleted = list(api.queue.jobs), list(api.storage.deleted)
    before = _fingerprint(api.conninfo)

    requests = [
        ("PATCH", f"/projects/{project_id}", {"name": "x"}),
        ("DELETE", f"/projects/{project_id}", None),
        ("GET", f"/projects/{project_id}/documents", None),
        ("POST", f"/projects/{project_id}/documents", {"name": "a.pdf", "size_bytes": 10}),
        ("GET", f"/documents/{document_id}", None),
        ("PATCH", f"/documents/{document_id}", {"name": "x.pdf"}),
        ("DELETE", f"/documents/{document_id}", None),
        ("GET", f"/documents/{document_id}/summaries", None),
        ("POST", f"/documents/{document_id}/summaries", None),
        ("GET", f"/summaries/{summary_id}", None),
        ("GET", f"/documents/{document_id}/flashcard-decks", None),
        ("POST", f"/documents/{document_id}/flashcard-decks", {"count": 1}),
        ("GET", f"/flashcard-decks/{deck_id}", None),
        ("GET", f"/documents/{document_id}/quizzes", None),
        ("POST", f"/documents/{document_id}/quizzes", {"count": 1}),
        ("GET", f"/quizzes/{quiz_id}", None),
        ("POST", f"/quizzes/{quiz_id}/attempts", {"answers": {questions[0]["id"]: 1, questions[1]["id"]: 3}}),
        ("GET", f"/projects/{project_id}/conversations", None),
        ("POST", f"/projects/{project_id}/conversations", {}),
        ("GET", f"/conversations/{conversation_id}/messages", None),
        ("DELETE", f"/conversations/{conversation_id}", None),
    ]
    for method, path, body in requests:
        assert api.client.request(method, path, json=body).status_code == 404, (method, path)

    assert _fingerprint(api.conninfo) == before
    assert (api.queue.jobs, api.storage.deleted) == (jobs, deleted)


def test_rejected_409_and_422_requests_leave_the_database_unchanged(api, conn):
    project_id = _project(api)
    document_id = _document(api, project_id)["document"]["id"]
    quiz_id = _ready_quiz(api, conn)
    q0, q1 = (q["id"] for q in api.client.get(f"/quizzes/{quiz_id}").json()["questions"])
    for n in range(19):
        _document(api, project_id, name=f"doc{n}.pdf")
    before = _fingerprint(api.conninfo)

    assert api.client.post(f"/projects/{project_id}/documents", json={"name": "x.pdf", "size_bytes": 10}).status_code == 409
    assert api.client.post(f"/documents/{document_id}/summaries").status_code == 409
    assert api.client.post(f"/documents/{document_id}/quizzes", json={"count": 2}).status_code == 409
    assert api.client.post(f"/documents/{document_id}/flashcard-decks", json={"count": 2}).status_code == 409
    for answers in ({q0: 1}, {q0: 1, q1: 4}, {q0: -1, q1: 0}, {q0: 1, q1: 0, "00000000-0000-0000-0000-000000000000": 1}):
        assert api.client.post(f"/quizzes/{quiz_id}/attempts", json={"answers": answers}).status_code == 422

    assert _fingerprint(api.conninfo) == before


def test_quiz_payloads_never_contain_the_answers_before_an_attempt(api, conn):
    quiz_id = _ready_quiz(api, conn)
    document_id = api.client.get(f"/quizzes/{quiz_id}").json()["document_id"]

    payloads = [
        api.client.get(f"/quizzes/{quiz_id}").text,
        api.client.get(f"/documents/{document_id}/quizzes").text,
        api.client.post(f"/documents/{document_id}/quizzes", json={"count": 1}).text,
    ]

    assert all("correct_index" not in p and "explanation" not in p for p in payloads)


def test_patch_project_changes_only_the_fields_sent(api):
    project_id = api.client.post("/projects", json={"name": "Bio", "description": "old"}).json()["id"]

    assert api.client.patch(f"/projects/{project_id}", json={"name": "Bio I"}).json()["description"] == "old"
    assert api.client.patch(f"/projects/{project_id}", json={"description": None}).json()["description"] is None
    assert api.client.patch(f"/projects/{project_id}", json={"name": None}).status_code == 422
    assert api.client.patch(f"/projects/{project_id}", json={}).json()["name"] == "Bio I"
    assert api.client.patch(f"/projects/{project_id}", json={"name": "Bio II"}).json()["description"] is None


KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
ISSUER, CLIENT = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_T", "client"


class Jwks:
    def get_signing_key_from_jwt(self, token):
        class Key:
            key = KEY.public_key()

        return Key()


def _token(key=KEY, **overrides):
    claims = {
        "sub": BOB.id,
        "email": BOB.email,
        "iss": ISSUER,
        "aud": CLIENT,
        "token_use": "id",
        "exp": int(time.time()) + 300,
    }
    claims.update(overrides)
    return jwt.encode({k: v for k, v in claims.items() if v is not None}, key, algorithm="RS256")


@pytest.fixture
def local_client(database):
    container = Container(catalog=PostgresCatalog(database), study=None, storage=None, queue=None)
    app = create_app(container, jwt_verifier=JwtVerifier(ISSUER, CLIENT, jwks_client=Jwks()))
    return TestClient(app, raise_server_exceptions=False)


@pytest.mark.parametrize(
    "authorization",
    [
        None,
        "Basic abc",
        "Bearer",
        "Bearer not-a-jwt",
        f"Bearer {_token(key=OTHER_KEY)}",
        f"Bearer {_token(token_use='access')}",
        f"Bearer {_token(aud='other')}",
        f"Bearer {_token(iss='https://evil.example.com')}",
        f"Bearer {_token(exp=int(time.time()) - 5)}",
        f"Bearer {_token(exp=None)}",
        f"Bearer {_token(email=None)}",
        "Bearer "
        + jwt.encode(
            {"sub": BOB.id, "email": BOB.email, "iss": ISSUER, "aud": CLIENT, "token_use": "id"}, None, algorithm="none"
        ),
    ],
)
def test_local_mode_rejects_bad_credentials_with_401_and_creates_no_user(database, local_client, authorization):
    headers = {"Authorization": authorization} if authorization else {}

    assert local_client.get("/me", headers=headers).status_code == 401
    with psycopg.connect(database) as conn:
        assert conn.execute("select count(*) from users").fetchone()[0] == 0


def test_local_mode_accepts_a_valid_id_token(local_client):
    response = local_client.get("/me", headers={"Authorization": f"Bearer {_token()}"})

    assert (response.status_code, response.json()["id"]) == (200, BOB.id)
