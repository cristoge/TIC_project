"""One chat turn: load the conversation, run the agent, stream events, persist the result.

Stream events (sent to the app over SSE by AgentCore Runtime):
  {"type": "token", "data": "..."}                                   text as it is generated
  {"type": "sources", "data": [{"n", "document_id", "document_name", "page"}]}   cited passages only
  {"type": "artifact", "kind": "summary" | "flashcards" | "quiz", "id": "..."}  created in this turn
  {"type": "end", "message_id": "..."}
"""

import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol

from services.agent_tools import Source, TurnRecorder

MAX_MESSAGE_CHARS = 4000
CITATION = re.compile(r"\[(\d+)\]")


class ConversationNotFound(Exception):
    pass


@dataclass(frozen=True)
class HistoryMessage:
    role: str  # "user" | "assistant"
    content: str


class ConversationRepository(Protocol):
    def project_of(self, user_id: str, conversation_id: str) -> str | None:
        """The conversation's project if the user owns it, else None."""
        ...

    def recent_messages(self, conversation_id: str, max_chars: int) -> list[HistoryMessage]:
        """Newest messages that fit in max_chars, oldest first, starting with a user message."""
        ...

    def save_turn(
        self, conversation_id: str, question: str, answer: str, sources: list[Source], artifacts: dict[str, str]
    ) -> str:
        """Store the question and the answer; return the answer's message id."""
        ...


class AgentRunner(Protocol):
    def stream(self, history: list[HistoryMessage], message: str, invocation_state: dict) -> AsyncIterator[str]: ...


@dataclass
class ChatService:
    conversations: ConversationRepository
    runner: AgentRunner
    history_chars: int = 16_000  # ~4,000 tokens

    async def chat(self, user_id: str, conversation_id: str, message: str) -> AsyncIterator[dict]:
        message = message.strip()
        if not message:
            raise ValueError("The message is empty.")
        if len(message) > MAX_MESSAGE_CHARS:
            raise ValueError(f"The message is longer than {MAX_MESSAGE_CHARS} characters.")
        project_id = self.conversations.project_of(user_id, conversation_id)
        if project_id is None:
            raise ConversationNotFound()

        history = self.conversations.recent_messages(conversation_id, self.history_chars)
        recorder = TurnRecorder()
        state = {"user_id": user_id, "project_id": project_id, "conversation_id": conversation_id, "recorder": recorder}

        chunks = []
        async for chunk in self.runner.stream(history, message, state):
            chunks.append(chunk)
            yield {"type": "token", "data": chunk}
        answer = "".join(chunks)

        cited = {int(n) for n in CITATION.findall(answer)}
        sources = [source for source in recorder.sources if source.n in cited]
        message_id = self.conversations.save_turn(conversation_id, message, answer, sources, recorder.artifacts)

        if sources:
            yield {
                "type": "sources",
                "data": [
                    {"n": s.n, "document_id": s.document_id, "document_name": s.document_name, "page": s.page}
                    for s in sources
                ],
            }
        for kind, artifact_id in recorder.artifacts.items():
            yield {"type": "artifact", "kind": kind, "id": artifact_id}
        yield {"type": "end", "message_id": message_id}
