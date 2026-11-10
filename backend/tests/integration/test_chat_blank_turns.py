"""A turn without text (turn limit hit in a tool loop, or whitespace only) saves nothing and the chat keeps working.

Runs the real Strands runner with a scripted model, ChatService and the Postgres repository; no AWS.
"""

import pytest

from adapters.bedrock.agent_runner import StrandsAgentRunner
from entrypoints.agent.handler import run_chat
from services.chat import ChatService
from tests.integration.test_api import ALICE
from tests.integration.test_chat_turns import _collect, fingerprint, world  # noqa: F401
from tests.unit.test_agent_runner_strands import ScriptedModel

NO_ANSWER = {"type": "error", "code": "no_answer", "message": "No answer could be produced. Please try again."}


def _chat(monkeypatch, repo, tools, model):
    return ChatService(repo, StrandsAgentRunner(tools, model_factory=lambda temperature: model))


def _history(repo, conversation_id):
    return [(m.role, m.content) for m in repo.recent_messages(conversation_id, 16000)]


@pytest.mark.parametrize(
    "model_factory,calls",
    [
        (lambda: ScriptedModel([("tool", "search_documents", {"query": "mitosis"})], repeat_last=True), 6),
        (lambda: ScriptedModel([("tool", "search_documents", {"query": "m"}), ("text", "  \n\t ")]), 2),
    ],
    ids=["tool loop", "whitespace"],
)
def test_blank_turn_saves_nothing_and_the_conversation_keeps_working(monkeypatch, conn, world, model_factory, calls):
    alice, _, repo, search, tools = world
    repo.save_turn(alice[3], "Q0", "A0 [1]", [], {})  # an earlier good turn
    before = fingerprint(conn)
    model = model_factory()

    events = _collect(run_chat(_chat(monkeypatch, repo, tools, model), ALICE, {"conversation_id": alice[3], "message": "pregunta"}))

    assert model.calls == calls
    assert search.calls, "the tools did run"
    assert events[-1] == NO_ANSWER
    assert not any(e["type"] in ("end", "sources") for e in events)
    assert fingerprint(conn) == before
    assert _history(repo, alice[3]) == [("user", "Q0"), ("assistant", "A0 [1]")]

    good = ScriptedModel([("text", "Respuesta [1].")])
    events = _collect(run_chat(_chat(monkeypatch, repo, tools, good), ALICE, {"conversation_id": alice[3], "message": "otra"}))

    assert events[-1]["type"] == "end"
    sent = [(m["role"], m["content"][0].get("text")) for m in good.seen_messages[0]]
    assert sent == [("user", "Q0"), ("assistant", "A0 [1]"), ("user", "otra")]
