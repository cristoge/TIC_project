"""Verifier probes: the Strands runner end to end with a scripted model (no AWS)."""

import asyncio
import json

import pytest
from strands.models import Model

from adapters.bedrock.agent_runner import StrandsAgentRunner, strands_tools
from domain.search import SearchResult
from services.agent_tools import AgentTools, TurnRecorder
from services.chat import HistoryMessage

PROJECT = "p1"
DOCS = [{"id": "d1", "name": "Tema3.pdf", "status": "ready", "page_count": 20}]


class Docs:
    def list_documents_of_project(self, project_id):
        return DOCS if project_id == PROJECT else []


class Search:
    def __init__(self):
        self.calls = []

    def search(self, project_id, query, document_ids=None):
        self.calls.append((project_id, query, document_ids))
        return [SearchResult(f"c{len(self.calls)}", "d1", "Tema3.pdf", 12, "Mitosis.", 0.03, 0.8, 0.9)]


class Unused:
    def __getattr__(self, name):
        raise AssertionError(f"unexpected call {name}")


class ScriptedModel(Model):
    """Each call pops one step: ("tool", name, input) or ("text", str)."""

    def __init__(self, steps, repeat_last=False):
        self.steps = list(steps)
        self.repeat_last = repeat_last
        self.calls = 0
        self.seen_messages = []

    def update_config(self, **kwargs):
        pass

    def get_config(self):
        return {}

    def structured_output(self, *args, **kwargs):
        raise NotImplementedError

    async def stream(self, messages, tool_specs=None, system_prompt=None, **kwargs):
        self.calls += 1
        self.seen_messages.append(json.loads(json.dumps(messages, default=str)))
        step = self.steps[0] if (self.repeat_last and len(self.steps) == 1) else self.steps.pop(0)
        yield {"messageStart": {"role": "assistant"}}
        if step[0] == "tool":
            yield {"contentBlockStart": {"start": {"toolUse": {"toolUseId": f"t{self.calls}", "name": step[1]}}}}
            yield {"contentBlockDelta": {"delta": {"toolUse": {"input": json.dumps(step[2])}}}}
            yield {"contentBlockStop": {}}
            yield {"messageStop": {"stopReason": "tool_use"}}
        else:
            yield {"contentBlockDelta": {"delta": {"text": step[1]}}}
            yield {"contentBlockStop": {}}
            yield {"messageStop": {"stopReason": "end_turn"}}
        yield {"metadata": {"usage": {"inputTokens": 1, "outputTokens": 1, "totalTokens": 2}, "metrics": {"latencyMs": 1}}}


def _run(monkeypatch, model, history=()):
    search = Search()
    tools = AgentTools(Docs(), search, Unused(), Unused())
    recorder = TurnRecorder()
    state = {"user_id": "u1", "project_id": PROJECT, "conversation_id": "cv", "recorder": recorder}

    async def collect():
        return [c async for c in StrandsAgentRunner(tools, model_factory=lambda temperature: model).stream(list(history), "pregunta", state)]

    return asyncio.run(collect()), recorder, search


def test_tool_schemas_expose_no_identity_or_project():
    tools = strands_tools(AgentTools(Docs(), Search(), Unused(), Unused()))
    names = {t.tool_spec["name"]: t.tool_spec["inputSchema"]["json"].get("properties", {}) for t in tools}
    assert set(names) == {"search_documents", "list_documents", "create_summary", "create_flashcards", "create_quiz"}
    for props in names.values():
        assert not {"user_id", "project_id", "conversation_id", "recorder", "tool_context"} & set(props)


def test_recorder_in_invocation_state_is_shared_and_model_supplied_ids_are_ignored(monkeypatch):
    model = ScriptedModel([
        ("tool", "search_documents", {"query": "mitosis", "project_id": "p-other", "user_id": "evil"}),
        ("tool", "search_documents", {"query": "x", "document_ids": ["d-of-another-user"]}),
        ("text", "La mitosis [1]."),
    ])

    chunks, recorder, search = _run(monkeypatch, model)

    assert "".join(chunks) == "La mitosis [1]."
    # first search ran in the server's project; the foreign document id never reached the search
    assert search.calls == [(PROJECT, "mitosis", None)]
    assert [s.chunk_id for s in recorder.sources] == ["c1"]
    tool_result = model.seen_messages[2][-1]["content"][0]["toolResult"]
    assert "Unknown document id" in json.dumps(tool_result)


def test_turn_limit_stops_a_tool_loop_after_six_model_calls_without_raising(monkeypatch):
    model = ScriptedModel([("tool", "list_documents", {})], repeat_last=True)

    chunks, _, _ = _run(monkeypatch, model)

    assert model.calls == 6
    assert chunks == []  # no text at all: ChatService turns this into a "no_answer" error and saves nothing


def test_history_is_passed_as_prior_messages(monkeypatch):
    model = ScriptedModel([("text", "ok")])
    _run(monkeypatch, model, [HistoryMessage("user", "Q1"), HistoryMessage("assistant", "A1")])
    roles = [(m["role"], m["content"][0].get("text")) for m in model.seen_messages[0]]
    assert roles == [("user", "Q1"), ("assistant", "A1"), ("user", "pregunta")]
