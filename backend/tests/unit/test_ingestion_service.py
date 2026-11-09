import pytest

from domain.documents import Page
from services.ingestion import NO_TEXT_MESSAGE, UNEXPECTED_ERROR_MESSAGE, IngestionService


class FakeRepository:
    def __init__(self):
        self.events = []
        self.saved = None

    def mark_processing(self, document_id):
        self.events.append(("processing", document_id))

    def save_chunks(self, document_id, chunks, embeddings, embedding_model, page_count):
        self.events.append(("ready", document_id))
        self.saved = {
            "chunks": chunks,
            "embeddings": embeddings,
            "embedding_model": embedding_model,
            "page_count": page_count,
        }

    def mark_failed(self, document_id, message):
        self.events.append(("failed", document_id, message))


class FakeStorage:
    def __init__(self, pdf=b"%PDF"):
        self.pdf = pdf
        self.saved_pages = {}

    def read_pdf(self, s3_key):
        assert s3_key == "users/u/projects/p/doc.pdf"
        return self.pdf

    def save_pages(self, document_id, pages):
        self.saved_pages[document_id] = pages


class FakePdfReader:
    def __init__(self, pages):
        self.pages = pages

    def extract_pages(self, pdf):
        return self.pages


class FakeEmbedder:
    model_id = "fake-embedder"

    def __init__(self, error=None):
        self.error = error

    def embed(self, texts):
        if self.error:
            raise self.error
        return [[float(len(text))] for text in texts]


def _service(pages, embedder=None):
    repository = FakeRepository()
    storage = FakeStorage()
    service = IngestionService(
        repository=repository,
        storage=storage,
        pdf_reader=FakePdfReader(pages),
        embedder=embedder or FakeEmbedder(),
    )
    return service, repository, storage


def test_ingest_stores_chunks_with_their_embeddings_and_marks_the_document_ready():
    pages = [Page(1, "Mitosis divides the nucleus."), Page(2, "Meiosis produces gametes.")]
    service, repository, storage = _service(pages)

    count = service.ingest("doc-1", "users/u/projects/p/doc.pdf")

    assert count == 1
    assert repository.events == [("processing", "doc-1"), ("ready", "doc-1")]
    chunk = repository.saved["chunks"][0]
    assert repository.saved["embeddings"] == [[float(len(chunk.content))]]
    assert repository.saved["embedding_model"] == "fake-embedder"
    assert repository.saved["page_count"] == 2
    assert storage.saved_pages["doc-1"] == pages


def test_pdf_without_text_is_marked_failed_without_retrying():
    service, repository, storage = _service([Page(1, ""), Page(2, "  ")])

    count = service.ingest("doc-1", "users/u/projects/p/doc.pdf")

    assert count == 0
    assert repository.events == [("processing", "doc-1"), ("failed", "doc-1", NO_TEXT_MESSAGE)]
    assert storage.saved_pages == {}


def test_unexpected_error_marks_the_document_failed_and_propagates_for_a_retry():
    error = RuntimeError("Bedrock throttled")
    service, repository, _ = _service([Page(1, "Some text.")], embedder=FakeEmbedder(error))

    with pytest.raises(RuntimeError, match="Bedrock throttled"):
        service.ingest("doc-1", "users/u/projects/p/doc.pdf")

    assert repository.events == [
        ("processing", "doc-1"),
        ("failed", "doc-1", UNEXPECTED_ERROR_MESSAGE),
    ]
