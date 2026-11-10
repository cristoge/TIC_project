import asyncio

import pytest

from services.agent_tools import Source
from services.chat import ChatService, ConversationNotFound, HistoryMessage, InvalidChatRequest


class FakeConversations:
    def __init__(self, project_id="p1", history=()):
        self.project_id = project_id
        self.history = list(history)
        self.saved = None
        self.history_budget = None

    def project_of(self, user_id, conversation_id):
        return self.project_id if user_id == "u1" else None

    def recent_messages(self, conversation_id, max_chars):
        self.history_budget = max_chars
        return self.history

    def save_turn(self, conversation_id, question, answer, sources, artifacts):
        self.saved = (conversation_id, question, answer, sources, artifacts)
        return "m2"


class FakeRunner:
    """Streams fixed chunks and plays the part of the tools on the recorder."""

    def __init__(self, chunks, sources=(), artifacts=None):
        self.chunks = chunks
        self.sources = sources
        self.artifacts = artifacts or {}
        self.calls = []

    async def stream(self, history, message, invocation_state):
        self.calls.append((history, message, dict(invocation_state)))
        recorder = invocation_state["recorder"]
        recorder.sources.extend(self.sources)
        recorder.artifacts.update(self.artifacts)
        for chunk in self.chunks:
            yield chunk


def _collect(service, **kwargs):
    async def run():
        return [event async for event in service.chat(**kwargs)]

    return asyncio.run(run())


SOURCES = [
    Source(1, "c1", "d1", "Tema3.pdf", 12),
    Source(2, "c2", "d1", "Tema3.pdf", 13),
    Source(3, "c3", "d2", "Tema4.pdf", 2),
]


def test_a_turn_streams_tokens_then_cited_sources_artifacts_and_end():
    conversations = FakeConversations()
    runner = FakeRunner(["La mitosis [1]", " divide el núcleo [3]."], SOURCES, {"quiz": "q1"})
    service = ChatService(conversations, runner)

    events = _collect(service, user_id="u1", conversation_id="c-1", message=" ¿Qué es la mitosis? ")

    assert events == [
        {"type": "token", "data": "La mitosis [1]"},
        {"type": "token", "data": " divide el núcleo [3]."},
        {
            "type": "sources",
            "data": [
                {"n": 1, "document_id": "d1", "document_name": "Tema3.pdf", "page": 12},
                {"n": 3, "document_id": "d2", "document_name": "Tema4.pdf", "page": 2},
            ],
        },
        {"type": "artifact", "kind": "quiz", "id": "q1"},
        {"type": "end", "message_id": "m2"},
    ]
    assert conversations.saved == (
        "c-1",
        "¿Qué es la mitosis?",
        "La mitosis [1] divide el núcleo [3].",
        [SOURCES[0], SOURCES[2]],
        {"quiz": "q1"},
    )


def test_the_agent_gets_the_history_and_the_server_side_identity():
    history = [HistoryMessage("user", "Hola"), HistoryMessage("assistant", "Hola, ¿en qué te ayudo?")]
    conversations = FakeConversations(history=history)
    runner = FakeRunner(["Ok."])
    service = ChatService(conversations, runner, history_chars=16_000)

    _collect(service, user_id="u1", conversation_id="c-1", message="Resume el tema 3")

    (passed_history, message, state), = runner.calls
    assert passed_history == history
    assert message == "Resume el tema 3"
    assert (state["user_id"], state["project_id"], state["conversation_id"]) == ("u1", "p1", "c-1")
    assert conversations.history_budget == 16_000


def test_answer_without_citations_saves_no_sources():
    conversations = FakeConversations()
    service = ChatService(conversations, FakeRunner(["No está en tus documentos."], SOURCES))

    events = _collect(service, user_id="u1", conversation_id="c-1", message="¿Fotosíntesis?")

    assert [e["type"] for e in events] == ["token", "end"]
    assert conversations.saved[3] == []


def test_someone_elses_conversation_is_not_found_and_nothing_runs():
    conversations = FakeConversations()
    runner = FakeRunner(["x"])
    service = ChatService(conversations, runner)

    with pytest.raises(ConversationNotFound):
        _collect(service, user_id="intruder", conversation_id="c-1", message="hola")
    assert runner.calls == [] and conversations.saved is None


@pytest.mark.parametrize("message", ["", "   ", "x" * 4001])
def test_empty_or_too_long_messages_are_rejected(message):
    service = ChatService(FakeConversations(), FakeRunner(["x"]))

    with pytest.raises(InvalidChatRequest):
        _collect(service, user_id="u1", conversation_id="c-1", message=message)


def test_a_blank_answer_still_announces_created_artifacts_but_saves_nothing():
    conversations = FakeConversations()
    service = ChatService(conversations, FakeRunner([], artifacts={"summary": "s1"}))

    events = _collect(service, user_id="u1", conversation_id="c-1", message="Resume el tema 3")

    assert events == [
        {"type": "artifact", "kind": "summary", "id": "s1"},
        {"type": "error", "code": "no_answer", "message": "No answer could be produced. Please try again."},
    ]
    assert conversations.saved is None
