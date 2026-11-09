"""Turns an uploaded PDF into searchable chunks."""

import logging
from dataclasses import dataclass
from typing import Protocol

from domain.documents import Chunk, Page
from services.chunking import split_into_chunks

logger = logging.getLogger(__name__)

NO_TEXT_MESSAGE = "The PDF has no extractable text. It may be a scanned document."
UNEXPECTED_ERROR_MESSAGE = "The document could not be processed."


class DocumentRepository(Protocol):
    def mark_processing(self, document_id: str) -> None: ...

    def save_chunks(
        self,
        document_id: str,
        chunks: list[Chunk],
        embeddings: list[list[float]],
        embedding_model: str,
        page_count: int,
    ) -> None:
        """Replace the document's chunks and mark it ready, atomically."""
        ...

    def mark_failed(self, document_id: str, message: str) -> None: ...


class DocumentStorage(Protocol):
    def read_pdf(self, s3_key: str) -> bytes: ...

    def save_pages(self, document_id: str, pages: list[Page]) -> None: ...


class PdfReader(Protocol):
    def extract_pages(self, pdf: bytes) -> list[Page]: ...


class Embedder(Protocol):
    model_id: str

    def embed(self, texts: list[str]) -> list[list[float]]: ...


@dataclass
class IngestionService:
    repository: DocumentRepository
    storage: DocumentStorage
    pdf_reader: PdfReader
    embedder: Embedder

    def ingest(self, document_id: str, s3_key: str) -> int:
        """Process the document and return how many chunks were stored.

        Safe to run again for the same document: the chunks are replaced.
        A PDF without text is a final failure; anything else is raised so the
        queue retries it.
        """
        self.repository.mark_processing(document_id)
        try:
            pages = self.pdf_reader.extract_pages(self.storage.read_pdf(s3_key))
            chunks = split_into_chunks(pages)
            if not chunks:
                self.repository.mark_failed(document_id, NO_TEXT_MESSAGE)
                return 0
            self.storage.save_pages(document_id, pages)
            embeddings = self.embedder.embed([chunk.content for chunk in chunks])
            self.repository.save_chunks(
                document_id, chunks, embeddings, self.embedder.model_id, page_count=len(pages)
            )
            return len(chunks)
        except Exception:
            logger.exception("Ingestion failed for document %s", document_id)
            self.repository.mark_failed(document_id, UNEXPECTED_ERROR_MESSAGE)
            raise
