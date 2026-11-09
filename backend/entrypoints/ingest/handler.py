"""SQS consumer for S3 upload notifications: one PDF per document.

Uses partial batch responses, so the event source mapping must enable
ReportBatchItemFailures; only the failing messages go back to the queue.
"""

import json
import logging
import os
from functools import cache
from typing import Protocol
from urllib.parse import unquote_plus

logger = logging.getLogger(__name__)


class DocumentLookup(Protocol):
    def find_id_by_s3_key(self, s3_key: str) -> str | None: ...


class Ingestion(Protocol):
    def ingest(self, document_id: str, s3_key: str) -> int: ...


def handle(event: dict, service: Ingestion, lookup: DocumentLookup) -> dict:
    failures = []
    for record in event["Records"]:
        try:
            for s3_key in _uploaded_keys(record["body"]):
                document_id = lookup.find_id_by_s3_key(s3_key)
                if document_id is None:
                    logger.warning("No document row for uploaded object %s; skipping", s3_key)
                    continue
                service.ingest(document_id, s3_key)
        except Exception:
            logger.exception("Message %s failed", record["messageId"])
            failures.append({"itemIdentifier": record["messageId"]})
    return {"batchItemFailures": failures}


def _uploaded_keys(body: str) -> list[str]:
    notification = json.loads(body)
    if notification.get("Event") == "s3:TestEvent":
        return []
    return [unquote_plus(item["s3"]["object"]["key"]) for item in notification.get("Records", [])]


@cache
def _dependencies():
    import boto3
    from botocore.config import Config

    from adapters.bedrock.embeddings import TitanEmbedder
    from adapters.pdf.pymupdf_reader import PyMuPdfReader
    from adapters.postgres.documents import PostgresDocumentRepository
    from adapters.s3.storage import S3DocumentStorage
    from services.ingestion import IngestionService

    repository = PostgresDocumentRepository(os.environ["DATABASE_URL"])
    bedrock = boto3.client("bedrock-runtime", config=Config(retries={"mode": "adaptive", "total_max_attempts": 8}))
    service = IngestionService(
        repository=repository,
        storage=S3DocumentStorage(boto3.client("s3"), os.environ["DOCUMENTS_BUCKET"]),
        pdf_reader=PyMuPdfReader(),
        embedder=TitanEmbedder(bedrock),
    )
    return service, repository


def lambda_handler(event, context):
    service, repository = _dependencies()
    return handle(event, service, repository)
