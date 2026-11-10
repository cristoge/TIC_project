"""Local mode only: the API receives the PDF that would go to S3 and starts ingestion itself.

In AWS the app posts the file straight to S3 with the presigned form and the S3
event reaches the ingestion Lambda through SQS; locally this route plays both parts.
As with a presigned form, the unguessable key is the authorization: it must belong
to a document that is still waiting for its file.
"""

from concurrent.futures import Executor, ThreadPoolExecutor

from entrypoints.api.schemas import MAX_UPLOAD_BYTES


class UploadRejected(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class LocalUploads:
    def __init__(self, storage, repository, ingestion, executor: Executor | None = None):
        self.storage = storage
        self.repository = repository
        self.ingestion = ingestion
        self.executor = executor or ThreadPoolExecutor(max_workers=1, thread_name_prefix="ingestion")

    def receive(self, key: str, content: bytes, content_type: str | None) -> None:
        document_id = self.repository.find_id_by_s3_key(key)
        if document_id is None:
            raise UploadRejected(404, "No document waits for this upload.")
        if self.repository.status_of(document_id) != "pending":
            raise UploadRejected(409, "This document already has its file.")
        if content_type != "application/pdf" or not content.startswith(b"%PDF"):
            raise UploadRejected(422, "Only PDF files are accepted.")
        if len(content) > MAX_UPLOAD_BYTES:
            raise UploadRejected(413, f"The file is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")
        self.storage.save_upload(key, content)
        self.executor.submit(self.ingestion.ingest, document_id, key)
