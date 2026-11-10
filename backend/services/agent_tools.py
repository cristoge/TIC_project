"""What the chat agent can do, independent of the agent framework.

Every method receives the project from the server-side request state, never
from the model, and checks any document id the model passes against that
project: a passage of a PDF that tries to steer the model ("ignore your
instructions...") can at most reach the user's own documents.
"""

from dataclasses import dataclass, field
from typing import Protocol

from domain.search import SearchResult
from services.study import DocumentNotReady, StudyService

UNKNOWN_DOCUMENT = "Unknown document id: {}. Use list_documents to get valid ids."
NO_RESULTS = "No relevant passages were found in the project's documents."
ARTIFACT_NAMES = {"summary": "summary", "flashcards": "flashcards", "quiz": "quiz"}


@dataclass(frozen=True)
class Source:
    n: int
    chunk_id: str
    document_id: str
    document_name: str
    page: int


@dataclass
class TurnRecorder:
    """Collects, during one chat turn, the passages shown to the model and the artifacts created."""

    sources: list[Source] = field(default_factory=list)
    artifacts: dict[str, str] = field(default_factory=dict)

    def number(self, results: list[SearchResult]) -> list[tuple[int, SearchResult]]:
        """Give each passage a citation number, reusing it when the same chunk shows up again."""
        known = {source.chunk_id: source.n for source in self.sources}
        numbered = []
        for result in results:
            if result.chunk_id not in known:
                known[result.chunk_id] = len(self.sources) + 1
                self.sources.append(
                    Source(known[result.chunk_id], result.chunk_id, result.document_id, result.document_name, result.page_number)
                )
            numbered.append((known[result.chunk_id], result))
        return numbered


class ProjectDocuments(Protocol):
    def list_documents_of_project(self, project_id: str) -> list[dict]: ...


class GenerationStatus(Protocol):
    def generation_status(self, kind: str, generation_id: str) -> tuple[str, str | None]: ...


class Search(Protocol):
    def search(self, project_id: str, query: str, document_ids: list[str] | None = None) -> list[SearchResult]: ...


@dataclass
class AgentTools:
    documents: ProjectDocuments
    search: Search
    study: StudyService
    status: GenerationStatus

    def search_documents(
        self, project_id: str, recorder: TurnRecorder, query: str, document_ids: list[str] | None = None
    ) -> str:
        if document_ids:
            unknown = self._unknown_documents(project_id, document_ids)
            if unknown:
                return UNKNOWN_DOCUMENT.format(", ".join(unknown))
        results = self.search.search(project_id, query, document_ids or None)
        if not results:
            return NO_RESULTS
        return "\n\n".join(
            f"[{n}] {r.document_name}, page {r.page_number}\n{r.content}" for n, r in recorder.number(results)
        )

    def list_documents(self, project_id: str) -> str:
        documents = self.documents.list_documents_of_project(project_id)
        if not documents:
            return "The project has no documents yet."
        return "\n".join(
            f"- {d['name']} (id: {d['id']}, status: {d['status']}, pages: {d['page_count'] or '?'})" for d in documents
        )

    def create_summary(self, project_id: str, recorder: TurnRecorder, document_id: str) -> str:
        return self._create(
            "summary", project_id, recorder, document_id,
            lambda: self.study.create_summary(document_id), self.study.generate_summary,
        )

    def create_flashcards(
        self, project_id: str, recorder: TurnRecorder, document_id: str, count: int = 10, topic: str | None = None
    ) -> str:
        return self._create(
            "flashcards", project_id, recorder, document_id,
            lambda: self.study.create_flashcards(document_id, count=count, topic=topic), self.study.generate_flashcards,
        )

    def create_quiz(
        self, project_id: str, recorder: TurnRecorder, document_id: str, count: int = 10, topic: str | None = None
    ) -> str:
        return self._create(
            "quiz", project_id, recorder, document_id,
            lambda: self.study.create_quiz(document_id, count=count, topic=topic), self.study.generate_quiz,
        )

    def _create(self, kind, project_id, recorder, document_id, create, generate) -> str:
        if self._unknown_documents(project_id, [document_id]):
            return UNKNOWN_DOCUMENT.format(document_id)
        try:
            generation_id = create()
        except (DocumentNotReady, ValueError) as error:
            return str(error)
        generate(generation_id)
        status, message = self.status.generation_status(kind, generation_id)
        if status != "ready":
            return f"The {ARTIFACT_NAMES[kind]} could not be created: {message}"
        recorder.artifacts[kind] = generation_id
        return (
            f"The {ARTIFACT_NAMES[kind]} was created. The app shows it to the user as a card; "
            "do not repeat its content, just tell the user it is ready."
        )

    def _unknown_documents(self, project_id: str, document_ids: list[str]) -> list[str]:
        valid = {str(d["id"]) for d in self.documents.list_documents_of_project(project_id)}
        return [document_id for document_id in document_ids if document_id not in valid]
