"""The PDF size limit: 30 MB, enforced when the document is created and when the file arrives."""

import pytest
from pydantic import ValidationError

from entrypoints.api.local_uploads import LocalUploads, UploadRejected
from entrypoints.api.schemas import DocumentIn
from tests.unit.test_local_mode import InlineExecutor

LIMIT = 30 * 1024 * 1024


def test_a_document_of_exactly_30_mb_can_be_created():
    assert DocumentIn(name="book.pdf", size_bytes=LIMIT).size_bytes == LIMIT


def test_a_document_over_30_mb_is_refused():
    with pytest.raises(ValidationError):
        DocumentIn(name="book.pdf", size_bytes=LIMIT + 1)


class PendingDocument:
    def find_id_by_s3_key(self, key):
        return "doc-1"

    def status_of(self, document_id):
        return "pending"


class Storage:
    def __init__(self):
        self.saved = []

    def save_upload(self, key, content):
        self.saved.append((key, len(content)))


class Ingestion:
    def ingest(self, document_id, key):
        return 1


def uploads(storage):
    return LocalUploads(storage, PendingDocument(), Ingestion(), executor=InlineExecutor())


def test_a_local_upload_of_exactly_30_mb_is_saved():
    storage = Storage()

    uploads(storage).receive("k.pdf", b"%PDF" + b"0" * (LIMIT - 4), "application/pdf")

    assert storage.saved == [("k.pdf", LIMIT)]


def test_a_local_upload_over_30_mb_is_refused():
    storage = Storage()

    with pytest.raises(UploadRejected) as rejected:
        uploads(storage).receive("k.pdf", b"%PDF" + b"0" * (LIMIT - 3), "application/pdf")

    assert (rejected.value.status_code, rejected.value.detail) == (413, "The file is larger than 30 MB.")
    assert storage.saved == []
