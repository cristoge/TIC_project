"""SQS consumer for study-artifact jobs: {"kind": "summary" | "flashcards" | "quiz", "id": "<row id>"}.

Uses partial batch responses (ReportBatchItemFailures). Final failures (too long,
nothing valid generated) are recorded by the service and not retried.
"""

import json
import logging
import os
from functools import cache
from typing import Protocol

logger = logging.getLogger(__name__)


class StudyGeneration(Protocol):
    def generate_summary(self, generation_id: str) -> None: ...

    def generate_flashcards(self, generation_id: str) -> None: ...

    def generate_quiz(self, generation_id: str) -> None: ...


def handle(event: dict, study: StudyGeneration) -> dict:
    runners = {
        "summary": study.generate_summary,
        "flashcards": study.generate_flashcards,
        "quiz": study.generate_quiz,
    }
    failures = []
    for record in event["Records"]:
        try:
            job = json.loads(record["body"])
            runners[job["kind"]](job["id"])
        except Exception:
            logger.exception("Message %s failed", record["messageId"])
            failures.append({"itemIdentifier": record["messageId"]})
    return {"batchItemFailures": failures}


@cache
def _study_service():
    import boto3
    from botocore.config import Config

    from adapters.bedrock.embeddings import TitanEmbedder
    from adapters.bedrock.rerank import BedrockReranker
    from adapters.bedrock.structured_llm import NOVA_2_LITE, StrandsStructuredLLM
    from adapters.postgres.search import PostgresSearchIndex
    from adapters.postgres.study import PostgresStudyRepository
    from adapters.s3.storage import S3DocumentStorage
    from services.search import SearchService
    from services.study import StudyService

    database_url = os.environ["DATABASE_URL"]
    retries = Config(retries={"mode": "adaptive", "total_max_attempts": 8})
    search = SearchService(
        index=PostgresSearchIndex(database_url),
        embedder=TitanEmbedder(boto3.client("bedrock-runtime", config=retries)),
        reranker=BedrockReranker(boto3.client("bedrock-agent-runtime", config=retries)),
    )
    return StudyService(
        repository=PostgresStudyRepository(database_url),
        pages=S3DocumentStorage(boto3.client("s3"), os.environ["DOCUMENTS_BUCKET"]),
        search=search,
        llm=StrandsStructuredLLM(boto_client_config=retries),
        model_id=NOVA_2_LITE,
    )


def lambda_handler(event, context):
    return handle(event, _study_service())
