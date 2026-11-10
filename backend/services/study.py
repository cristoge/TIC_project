"""Summaries, flashcard decks and multiple-choice quizzes generated from a document.

Each artifact is created as a 'pending' row (create_*) and filled later
(generate_*): the REST API runs the second step from a queue, the agent runs
both steps in a row.
"""

import logging
import random
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Protocol, TypeVar

from pydantic import BaseModel

from domain.documents import Page
from domain.study import (
    Flashcard,
    FlashcardSet,
    GradedAnswer,
    Quiz,
    QuizAttemptResult,
    QuizQuestion,
    Summary,
)
from services.search import SearchService

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

SUMMARY_TEMPERATURE = 0.3
QUIZ_TEMPERATURE = 0.5
FLASHCARDS_TEMPERATURE = 0.7

MAX_SUMMARY_CHARS = 1_500_000  # ~375k tokens, well inside Nova 2 Lite's 1M context
SAMPLE_CHARS = 60_000  # source text for flashcards and quizzes without a topic
MAX_ITEMS = 30
MAX_QUESTION_CHARS = 200
MAX_ANSWER_CHARS = 400

UNEXPECTED_ERROR_MESSAGE = "The content could not be generated."

SUMMARY_INSTRUCTIONS = """You summarize study material for a student.
Write in the same language as the document. Use only information from the document.
Each page starts with a [Page N] marker; cite in each section the pages it comes from."""

FLASHCARD_INSTRUCTIONS = """You write study flashcards from the material provided.
Write {count} flashcards in the same language as the material. Use only information from the material.
Each card asks one concrete thing and has a short, direct answer.
Each page starts with a [Page N] marker; give the page each answer comes from.
Never repeat a question listed as already used."""

QUIZ_INSTRUCTIONS = """You write multiple-choice quiz questions from the material provided.
Write {count} questions in the same language as the material. Use only information from the material.
Each question has exactly four different options and only one is correct; the wrong options must be plausible.
Explain briefly why the correct option is right.
Each page starts with a [Page N] marker; give the page each answer comes from."""


class DocumentNotReady(Exception):
    pass


class FinalGenerationError(Exception):
    """A failure that retrying cannot fix; its message is shown to the user."""


@dataclass(frozen=True)
class DocumentInfo:
    project_id: str
    page_count: int
    status: str


@dataclass(frozen=True)
class GenerationRequest:
    document_id: str
    topic: str | None = None
    requested_count: int | None = None


@dataclass(frozen=True)
class StoredQuestion:
    id: str
    correct_index: int
    explanation: str


class StudyRepository(Protocol):
    def get_document(self, document_id: str) -> DocumentInfo: ...

    def create_generation(
        self,
        kind: str,
        document_id: str,
        model: str,
        topic: str | None = None,
        requested_count: int | None = None,
    ) -> str: ...

    def get_request(self, kind: str, generation_id: str) -> GenerationRequest: ...

    def complete_summary(self, summary_id: str, content: dict) -> None: ...

    def complete_deck(self, deck_id: str, cards: list[Flashcard]) -> None: ...

    def complete_quiz(self, quiz_id: str, questions: list[QuizQuestion]) -> None: ...

    def fail_generation(self, kind: str, generation_id: str, message: str) -> None: ...

    def previous_questions(self, document_id: str) -> list[str]: ...

    def quiz_questions(self, quiz_id: str) -> list[StoredQuestion]:
        """Questions of a ready quiz, in order; empty if the quiz is not ready."""
        ...

    def save_attempt(
        self, quiz_id: str, score: int, total: int, answers: list[GradedAnswer]
    ) -> str: ...


class PagesSource(Protocol):
    def load_pages(self, document_id: str) -> list[Page]: ...


class StructuredLLM(Protocol):
    def generate(
        self, instructions: str, content: str, output_type: type[T], temperature: float
    ) -> T: ...


@dataclass
class StudyService:
    repository: StudyRepository
    pages: PagesSource
    search: SearchService
    llm: StructuredLLM
    model_id: str
    rng: random.Random = field(default_factory=random.Random)

    # --- create (pending rows) ---------------------------------------------------

    def create_summary(self, document_id: str) -> str:
        self._require_ready(document_id)
        return self.repository.create_generation("summary", document_id, self.model_id)

    def create_flashcards(
        self, document_id: str, count: int = 10, topic: str | None = None
    ) -> str:
        return self._create_set("flashcards", document_id, count, topic)

    def create_quiz(
        self, document_id: str, count: int = 10, topic: str | None = None
    ) -> str:
        return self._create_set("quiz", document_id, count, topic)

    # --- generate (fill the rows) ------------------------------------------------

    def generate_summary(self, summary_id: str) -> None:
        request = self.repository.get_request("summary", summary_id)
        with self._failing_on_error("summary", summary_id):
            text = _tagged(self.pages.load_pages(request.document_id))
            if len(text) > MAX_SUMMARY_CHARS:
                raise FinalGenerationError("The document is too long to summarize.")
            summary = self.llm.generate(
                SUMMARY_INSTRUCTIONS, text, Summary, SUMMARY_TEMPERATURE
            )
            self.repository.complete_summary(summary_id, summary.model_dump())

    def generate_flashcards(self, deck_id: str) -> None:
        request = self.repository.get_request("flashcards", deck_id)
        with self._failing_on_error("flashcards", deck_id):
            document = self.repository.get_document(request.document_id)
            previous = self.repository.previous_questions(request.document_id)
            content = self._source_text(request, document)
            if previous:
                content += "\n\nQuestions already used:\n" + "\n".join(
                    f"- {q}" for q in previous
                )
            instructions = FLASHCARD_INSTRUCTIONS.format(count=request.requested_count)
            generated = self.llm.generate(
                instructions, content, FlashcardSet, FLASHCARDS_TEMPERATURE
            )
            cards = _valid_cards(
                generated.cards, previous, document.page_count, request.requested_count
            )
            if not cards:
                raise FinalGenerationError("No valid flashcards could be generated.")
            self.repository.complete_deck(deck_id, cards)

    def generate_quiz(self, quiz_id: str) -> None:
        request = self.repository.get_request("quiz", quiz_id)
        with self._failing_on_error("quiz", quiz_id):
            document = self.repository.get_document(request.document_id)
            content = self._source_text(request, document)
            instructions = QUIZ_INSTRUCTIONS.format(count=request.requested_count)
            generated = self.llm.generate(instructions, content, Quiz, QUIZ_TEMPERATURE)
            questions = self._valid_questions(
                generated.questions, document.page_count, request.requested_count
            )
            if not questions:
                raise FinalGenerationError(
                    "No valid quiz questions could be generated."
                )
            self.repository.complete_quiz(quiz_id, questions)

    # --- grading -------------------------------------------------------------------

    def grade_quiz(self, quiz_id: str, answers: dict[str, int]) -> QuizAttemptResult:
        """Grade on the server, so the correct answers never reach the app before answering."""
        questions = self.repository.quiz_questions(quiz_id)
        if not questions:
            raise ValueError("The quiz is not ready.")
        if set(answers) != {q.id for q in questions}:
            raise ValueError("Answer every question of the quiz exactly once.")
        if any(not 0 <= selected <= 3 for selected in answers.values()):
            raise ValueError("Each answer must be an option index from 0 to 3.")

        graded = [
            GradedAnswer(
                question_id=q.id,
                selected_index=answers[q.id],
                correct_index=q.correct_index,
                is_correct=answers[q.id] == q.correct_index,
                explanation=q.explanation,
            )
            for q in questions
        ]
        score = sum(answer.is_correct for answer in graded)
        attempt_id = self.repository.save_attempt(quiz_id, score, len(graded), graded)
        return QuizAttemptResult(
            attempt_id=attempt_id, score=score, total=len(graded), answers=graded
        )

    # --- helpers -------------------------------------------------------------------

    def _create_set(
        self, kind: str, document_id: str, count: int, topic: str | None
    ) -> str:
        if not 1 <= count <= MAX_ITEMS:
            raise ValueError(f"The number of items must be between 1 and {MAX_ITEMS}.")
        self._require_ready(document_id)
        topic = topic.strip() if topic and topic.strip() else None
        return self.repository.create_generation(
            kind, document_id, self.model_id, topic=topic, requested_count=count
        )

    def _require_ready(self, document_id: str) -> None:
        if self.repository.get_document(document_id).status != "ready":
            raise DocumentNotReady("The document is not ready yet.")

    def _source_text(self, request: GenerationRequest, document: DocumentInfo) -> str:
        if request.topic:
            results = self.search.search(
                document.project_id, request.topic, document_ids=[request.document_id]
            )
            if not results:
                raise FinalGenerationError(
                    f"Nothing about '{request.topic}' was found in the document."
                )
            return "\n\n".join(f"[Page {r.page_number}]\n{r.content}" for r in results)
        return _tagged(
            _spread_sample(self.pages.load_pages(request.document_id), SAMPLE_CHARS)
        )

    def _valid_questions(
        self, questions: list[QuizQuestion], page_count: int, limit: int
    ) -> list[QuizQuestion]:
        valid, seen = [], set()
        for question in questions:
            text = question.question.strip()
            options = [option.strip() for option in question.options]
            if (
                not text
                or _normalized(text) in seen
                or len(options) != 4
                or not all(options)
                or len({o.casefold() for o in options}) != 4
                or not 0 <= question.correct_index <= 3
            ):
                continue
            seen.add(_normalized(text))
            correct = options[question.correct_index]
            shuffled = options[:]
            self.rng.shuffle(shuffled)
            valid.append(
                question.model_copy(
                    update={
                        "question": text,
                        "options": shuffled,
                        "correct_index": shuffled.index(correct),
                        "page": _clamp(question.page, page_count),
                    }
                )
            )
            if len(valid) == limit:
                break
        return valid

    @contextmanager
    def _failing_on_error(self, kind: str, generation_id: str):
        """Final failures are recorded and swallowed; anything else is recorded and re-raised for a retry."""
        try:
            yield
        except FinalGenerationError as error:
            self.repository.fail_generation(kind, generation_id, str(error))
        except Exception:
            logger.exception("Generating %s %s failed", kind, generation_id)
            self.repository.fail_generation(
                kind, generation_id, UNEXPECTED_ERROR_MESSAGE
            )
            raise


def _tagged(pages: list[Page]) -> str:
    return "\n\n".join(
        f"[Page {page.number}]\n{page.text.strip()}"
        for page in pages
        if page.text.strip()
    )


def _spread_sample(pages: list[Page], budget: int) -> list[Page]:
    """All pages if they fit; otherwise evenly spaced pages, so every part of the document is covered."""
    pages = [page for page in pages if page.text.strip()]
    total = sum(len(page.text) for page in pages)
    if total <= budget:
        return pages
    keep = max(1, int(len(pages) * budget / total))
    if keep == 1:
        return pages[:1]
    step = (len(pages) - 1) / (keep - 1)
    return [pages[round(i * step)] for i in range(keep)]


def _valid_cards(
    cards: list[Flashcard], previous: list[str], page_count: int, limit: int
) -> list[Flashcard]:
    valid, seen = [], {_normalized(q) for q in previous}
    for card in cards:
        question, answer = card.question.strip(), card.answer.strip()
        if (
            not question
            or not answer
            or len(question) > MAX_QUESTION_CHARS
            or len(answer) > MAX_ANSWER_CHARS
            or _normalized(question) in seen
        ):
            continue
        seen.add(_normalized(question))
        valid.append(
            Flashcard(
                question=question, answer=answer, page=_clamp(card.page, page_count)
            )
        )
        if len(valid) == limit:
            break
    return valid


def _normalized(text: str) -> str:
    return " ".join(text.casefold().split()).rstrip("?¿!¡. ")


def _clamp(page: int, page_count: int) -> int:
    return min(max(page, 1), max(page_count, 1))
