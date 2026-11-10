"""Study artifacts. The pydantic models double as the structured-output schemas for the LLM."""

from dataclasses import dataclass

from pydantic import BaseModel, Field


class SummarySection(BaseModel):
    heading: str = Field(description="Short section title.")
    points: list[str] = Field(description="Two to five short bullet points.")
    pages: list[int] = Field(description="Pages this section comes from.")


class KeyTerm(BaseModel):
    term: str
    definition: str = Field(description="One-line definition.")


class Summary(BaseModel):
    overview: str = Field(description="Two or three sentences about the whole document.")
    sections: list[SummarySection]
    key_terms: list[KeyTerm]


class Flashcard(BaseModel):
    question: str = Field(description="At most about 15 words.")
    answer: str = Field(description="At most about 40 words.")
    page: int = Field(description="Page the answer comes from.")


class FlashcardSet(BaseModel):
    cards: list[Flashcard]


class QuizQuestion(BaseModel):
    question: str
    options: list[str] = Field(description="Exactly four different options.")
    correct_index: int = Field(description="0-based index of the correct option.")
    explanation: str = Field(description="Why the correct option is right.")
    page: int = Field(description="Page the answer comes from.")


class Quiz(BaseModel):
    questions: list[QuizQuestion]


@dataclass(frozen=True)
class GradedAnswer:
    question_id: str
    selected_index: int
    correct_index: int
    is_correct: bool
    explanation: str


@dataclass(frozen=True)
class QuizAttemptResult:
    attempt_id: str
    score: int
    total: int
    answers: list[GradedAnswer]
