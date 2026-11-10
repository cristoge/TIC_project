"""Request and response bodies: the REST contract (also published as OpenAPI at /docs)."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

MAX_UPLOAD_BYTES = 30 * 1024 * 1024
MAX_DOCUMENTS_PER_PROJECT = 20

DocumentStatus = Literal["pending", "processing", "ready", "failed"]
GenerationStatus = Literal["pending", "ready", "failed"]


class MeOut(BaseModel):
    id: UUID
    email: str
    name: str | None


class MeUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class ProjectUpdate(BaseModel):
    """Only the fields sent are changed; `description: null` clears it, `name` cannot be null."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def name_cannot_be_null(cls, name: str | None) -> str:
        if name is None:
            raise ValueError("The project name cannot be null.")
        return name


class ProjectOut(BaseModel):
    id: UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class DocumentIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    size_bytes: int = Field(ge=1, le=MAX_UPLOAD_BYTES)

    @field_validator("name")
    @classmethod
    def must_be_a_pdf(cls, name: str) -> str:
        if not name.lower().endswith(".pdf"):
            raise ValueError("Only PDF files are accepted.")
        return name


class DocumentUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class DocumentOut(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    s3_key: str
    size_bytes: int | None
    page_count: int | None
    status: DocumentStatus
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class UploadOut(BaseModel):
    """Presigned POST: send a multipart form to `url` with every field in `fields` plus the file as `file`."""

    url: str
    fields: dict[str, str]


class DocumentCreatedOut(BaseModel):
    document: DocumentOut
    upload: UploadOut


class SetRequest(BaseModel):
    count: int = Field(default=10, ge=1, le=30)
    topic: str | None = Field(default=None, max_length=200)


class SummaryOut(BaseModel):
    id: UUID
    document_id: UUID
    status: GenerationStatus
    content: dict | None
    error_message: str | None
    created_at: datetime


class CardOut(BaseModel):
    question: str
    answer: str
    page: int


class DeckOut(BaseModel):
    id: UUID
    document_id: UUID
    topic: str | None
    requested_count: int
    status: GenerationStatus
    error_message: str | None
    created_at: datetime
    cards: list[CardOut] = []


class QuizQuestionOut(BaseModel):
    id: UUID
    question: str
    options: list[str]
    page: int


class QuizOut(BaseModel):
    id: UUID
    document_id: UUID
    topic: str | None
    requested_count: int
    status: GenerationStatus
    error_message: str | None
    created_at: datetime
    questions: list[QuizQuestionOut] = []


class AttemptIn(BaseModel):
    answers: dict[str, int] = Field(description="Selected option index (0-3) per question id.")


class GradedAnswerOut(BaseModel):
    question_id: UUID
    selected_index: int
    correct_index: int
    is_correct: bool
    explanation: str


class AttemptOut(BaseModel):
    attempt_id: UUID
    score: int
    total: int
    answers: list[GradedAnswerOut]


class ConversationIn(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class ConversationOut(BaseModel):
    id: UUID
    project_id: UUID
    title: str | None
    created_at: datetime
    updated_at: datetime


class SourceOut(BaseModel):
    n: int
    document_id: UUID
    document_name: str
    page: int


class MessageOut(BaseModel):
    id: UUID
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
    summary_id: UUID | None
    flashcard_deck_id: UUID | None
    quiz_id: UUID | None
    sources: list[SourceOut]
