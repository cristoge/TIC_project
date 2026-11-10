"""Local mode: the API itself receives the upload that S3 would receive, then starts ingestion."""

import random

import pytest
from fastapi.testclient import TestClient

from adapters.local.storage import LocalDocumentStorage
from adapters.postgres.catalog import PostgresCatalog
from adapters.postgres.documents import PostgresDocumentRepository
from adapters.postgres.study import PostgresStudyRepository
from entrypoints.api.app import Container, create_app
from entrypoints.api.auth import CurrentUser, get_current_user
from entrypoints.api.local_uploads import LocalUploads
from services.study import StudyService
from tests.unit.test_local_mode import InlineExecutor

ALICE = CurrentUser(id="00000000-0000-0000-0000-00000000000a", email="alice@example.com")


class FakeIngestion:
    def __init__(self):
        self.calls = []

    def ingest(self, document_id, s3_key):
        self.calls.append((document_id, s3_key))
        return 1


@pytest.fixture
def local(database, tmp_path):
    storage = LocalDocumentStorage(tmp_path, public_base_url="http://testserver")
    ingestion = FakeIngestion()
    uploads = LocalUploads(storage, PostgresDocumentRepository(database), ingestion, executor=InlineExecutor())
    study = StudyService(PostgresStudyRepository(database), storage, None, None, "deepseek", rng=random.Random(1))
    container = Container(catalog=PostgresCatalog(database), study=study, storage=storage, queue=None)
    app = create_app(container, local_uploads=uploads)
    app.dependency_overrides[get_current_user] = lambda: ALICE
    client = TestClient(app)
    project_id = client.post("/projects", json={"name": "Biology"}).json()["id"]
    return client, storage, ingestion, project_id


def _create(client, project_id):
    created = client.post(f"/projects/{project_id}/documents", json={"name": "Tema3.pdf", "size_bytes": 8}).json()
    return created["document"], created["upload"]


def test_upload_to_the_returned_form_stores_the_pdf_and_starts_ingestion(local):
    client, storage, ingestion, project_id = local
    document, upload = _create(client, project_id)

    response = client.post(
        upload["url"].removeprefix("http://testserver"),
        data=upload["fields"],
        files={"file": ("Tema3.pdf", b"%PDF-1.7", "application/pdf")},
    )

    assert response.status_code == 204
    assert storage.read_pdf(document["s3_key"]) == b"%PDF-1.7"
    assert ingestion.calls == [(document["id"], document["s3_key"])]


def test_upload_for_an_unknown_key_is_rejected(local):
    client, _, ingestion, _ = local

    response = client.post(
        "/local-uploads",
        data={"key": "users/x/projects/y/z.pdf"},
        files={"file": ("a.pdf", b"%PDF", "application/pdf")},
    )

    assert response.status_code == 404
    assert ingestion.calls == []


def test_only_pdfs_are_accepted(local):
    client, _, ingestion, project_id = local
    _, upload = _create(client, project_id)

    response = client.post(
        "/local-uploads", data=upload["fields"], files={"file": ("a.pdf", b"hello", "text/plain")}
    )

    assert response.status_code == 422
    assert ingestion.calls == []


def test_a_document_is_uploaded_only_once(local):
    client, _, ingestion, project_id = local
    _, upload = _create(client, project_id)
    form = {"file": ("a.pdf", b"%PDF", "application/pdf")}

    assert client.post("/local-uploads", data=upload["fields"], files=form).status_code == 204
    client.app.state.local_uploads.repository.mark_processing(ingestion.calls[0][0])

    assert client.post("/local-uploads", data=upload["fields"], files=form).status_code == 409
    assert len(ingestion.calls) == 1
