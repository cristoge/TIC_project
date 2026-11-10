"""Verifier probes: chat turn against the real Postgres repository (no AWS)."""

import asyncio
import hashlib

import pytest

from adapters.postgres.conversations import PostgresConversationRepository
from domain.search import SearchResult
from entrypoints.agent.handler import run_chat
from services.agent_tools import AgentTools
from services.chat import ChatService
from tests.integration.test_api import ALICE, BOB, api  # noqa: F401  (fixture reuse)

TABLES = ["users", "projects", "documents", "document_chunks", "conversations", "chat_messages", "message_sources",
          "summaries", "flashcard_decks", "flashcards", "quizzes", "quiz_questions"]


def fingerprint(conn):
    h = hashlib.sha256()
    for t in TABLES:
        for row in conn.execute(f"select * from {t} order by 1").fetchall():
            h.update(repr(row).encode())
    return h.hexdigest()


def seed(conn, user, name):
    conn.execute("insert into users (id, email) values (%s, %s) on conflict do nothing", (user.id, user.email))
    project = conn.execute("insert into projects (user_id, name) values (%s, %s) returning id::text", (user.id, name)).fetchone()[0]
    doc = conn.execute(
        "insert into documents (project_id, name, s3_key, status, page_count) values (%s, %s, %s, 'ready', 20) returning id::text",
        (project, f"{name}.pdf", f"k-{name}"),
    ).fetchone()[0]
    chunks = [
        conn.execute(
            "insert into document_chunks (document_id, chunk_index, page_number, content, embedding, embedding_model) "
            "values (%s, %s, %s, 'txt', array_fill(0, array[512])::vector, 'm') returning id::text",
            (doc, i, i + 1),
        ).fetchone()[0]
        for i in range(3)
    ]
    conv = conn.execute("insert into conversations (project_id) values (%s) returning id::text", (project,)).fetchone()[0]
    return project, doc, chunks, conv


class RecordingSearch:
    def __init__(self, chunks_by_project):
        self.chunks_by_project = chunks_by_project
        self.calls = []

    def search(self, project_id, query, document_ids=None):
        self.calls.append((project_id, query, document_ids))
        doc, chunks = self.chunks_by_project[project_id]
        return [SearchResult(c, doc, "Doc.pdf", i + 1, "txt", 0.1, 0.1, 0.1) for i, c in enumerate(chunks)]


class ToolCallingRunner:
    """Plays a model: runs tools through the state, like the Strands wrappers do."""

    def __init__(self, tools, script, answer):
        self.tools, self.script, self.answer, self.ran = tools, script, answer, False

    async def stream(self, history, message, state):
        self.ran = True
        for name, kwargs in self.script:
            getattr(self.tools, name)(state["project_id"], state["recorder"], **kwargs)
        for piece in self.answer:
            yield piece


class StudyUnused:
    """Bound methods may be looked up; any call fails the probe."""

    def __getattr__(self, name):
        def fail(*args, **kwargs):
            raise AssertionError(f"study.{name} called")
        return fail


def _collect(gen):
    async def run():
        return [e async for e in gen]
    return asyncio.run(run())


@pytest.fixture
def world(conn, database):
    alice = seed(conn, ALICE, "Bio")
    bob = seed(conn, BOB, "Chem")
    repo = PostgresConversationRepository(database)
    search = RecordingSearch({alice[0]: (alice[1], alice[2]), bob[0]: (bob[1], bob[2])})
    tools = AgentTools(documents=repo, search=search, study=StudyUnused(), status=repo)
    return alice, bob, repo, search, tools


def test_rejected_requests_leave_the_database_unchanged(conn, world):
    alice, bob, repo, search, tools = world
    before = fingerprint(conn)
    runner = ToolCallingRunner(tools, [("search_documents", {"query": "x"})], ["A [1]"])
    chat = ChatService(repo, runner)
    cases = [
        (None, {"conversation_id": alice[3], "message": "hola"}, "unauthenticated"),
        (ALICE, {"conversation_id": alice[3]}, "invalid_request"),
        (ALICE, {"conversation_id": alice[3], "message": 7}, "invalid_request"),
        (ALICE, {"conversation_id": "x", "message": "hola"}, "invalid_request"),
        (ALICE, ["not", "a", "dict"], "invalid_request"),
        (ALICE, {"conversation_id": bob[3], "message": "hola"}, "not_found"),
        (BOB, {"conversation_id": alice[3], "message": "hola", "user_id": ALICE.id}, "not_found"),
        (ALICE, {"conversation_id": alice[3], "message": "   "}, "invalid_request"),
        (ALICE, {"conversation_id": alice[3], "message": "x" * 4001}, "invalid_request"),
        (ALICE, {"conversation_id": "00000000-0000-0000-0000-000000000000", "message": "hola"}, "not_found"),
    ]
    for user, payload, code in cases:
        events = _collect(run_chat(chat, user, payload))
        assert [e.get("code") for e in events] == [code], (payload, events)
    assert runner.ran is False and search.calls == []
    assert fingerprint(conn) == before


def test_message_of_exactly_4000_chars_after_strip_is_accepted(conn, world):
    alice, _, repo, _, tools = world
    chat = ChatService(repo, ToolCallingRunner(tools, [], ["ok"]))
    events = _collect(run_chat(chat, ALICE, {"conversation_id": alice[3], "message": "  " + "x" * 4000 + "  "}))
    assert events[-1]["type"] == "end"


def test_foreign_document_ids_from_the_model_are_refused_before_search(conn, world):
    alice, bob, repo, search, tools = world
    from services.agent_tools import TurnRecorder
    rec = TurnRecorder()
    out = tools.search_documents(alice[0], rec, "q", [bob[1]])
    assert "Unknown document id" in out and search.calls == [] and rec.sources == []
    out = tools.search_documents(alice[0], rec, "q", [alice[1], bob[1]])
    assert "Unknown document id" in out and search.calls == []
    assert "Unknown document id" in tools.create_summary(alice[0], rec, bob[1])
    assert "Unknown document id" in tools.create_quiz(alice[0], rec, "'; drop table users; --")
    assert bob[1] not in tools.list_documents(alice[0])


def test_full_turn_saves_only_cited_sources_and_lists_question_first(conn, world, api):  # noqa: F811
    alice, _, repo, search, tools = world
    runner = ToolCallingRunner(
        tools,
        [("search_documents", {"query": "a"}), ("search_documents", {"query": "b"})],  # second search repeats the chunks
        ["Primero [3]", " y luego [1][9]."],
    )
    chat = ChatService(repo, runner)
    events = _collect(run_chat(chat, ALICE, {"conversation_id": alice[3], "message": "pregunta"}))

    assert search.calls == [(alice[0], "a", None), (alice[0], "b", None)]
    sources = [e for e in events if e["type"] == "sources"][0]["data"]
    assert [s["n"] for s in sources] == [1, 3]
    assert [s["page"] for s in sources] == [1, 3]
    message_id = events[-1]["message_id"]
    saved = conn.execute("select chunk_id::text, rank from message_sources where message_id = %s order by rank", (message_id,)).fetchall()
    assert saved == [(alice[2][0], 1), (alice[2][2], 3)]

    messages = api.client.get(f"/conversations/{alice[3]}/messages").json()
    assert [(m["role"], m["content"]) for m in messages] == [("user", "pregunta"), ("assistant", "Primero [3] y luego [1][9].")]
    assert [s["n"] for s in messages[1]["sources"]] == [1, 3]
    history = repo.recent_messages(alice[3], 16000)
    assert [(m.role, m.content) for m in history] == [("user", "pregunta"), ("assistant", "Primero [3] y luego [1][9].")]


def test_turn_without_any_text_is_reported_and_never_saved(conn, world):
    alice, _, repo, _, tools = world
    before = fingerprint(conn)
    # an empty stream is what the runner yields when limit_turns stops a tool loop with no text
    chat = ChatService(repo, ToolCallingRunner(tools, [], ["  "]))

    events = _collect(run_chat(chat, ALICE, {"conversation_id": alice[3], "message": "pregunta"}))

    assert events[-1] == {"type": "error", "code": "no_answer", "message": "No answer could be produced. Please try again."}
    assert "end" not in [e["type"] for e in events]
    assert repo.recent_messages(alice[3], 16000) == []
    assert fingerprint(conn) == before
