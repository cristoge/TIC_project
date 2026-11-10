"""Builds the API from environment variables.

AWS (Lambda behind API Gateway): `lambda_handler` below; the Cognito authorizer validates tokens.
Local: `uv run uvicorn entrypoints.api.main:local_app --factory --reload`, with
COGNITO_ISSUER and COGNITO_CLIENT_ID set so ID tokens are validated here.

Environment: DATABASE_URL, DOCUMENTS_BUCKET, GENERATION_QUEUE_URL.
"""

import os

import boto3
from botocore.config import Config
from mangum import Mangum

from adapters.bedrock.embeddings import TitanEmbedder
from adapters.bedrock.rerank import BedrockReranker
from adapters.bedrock.structured_llm import NOVA_2_LITE, StrandsStructuredLLM
from adapters.postgres.catalog import PostgresCatalog
from adapters.postgres.search import PostgresSearchIndex
from adapters.postgres.study import PostgresStudyRepository
from adapters.s3.storage import S3DocumentStorage
from adapters.sqs.queue import SqsJobQueue
from entrypoints.api.app import Container, create_app
from entrypoints.api.auth import JwtVerifier
from services.search import SearchService
from services.study import StudyService


def build_container() -> Container:
    database_url = os.environ["DATABASE_URL"]
    retries = Config(retries={"mode": "adaptive", "total_max_attempts": 8})
    storage = S3DocumentStorage(boto3.client("s3", config=Config(signature_version="s3v4")), os.environ["DOCUMENTS_BUCKET"])
    search = SearchService(
        index=PostgresSearchIndex(database_url),
        embedder=TitanEmbedder(boto3.client("bedrock-runtime", config=retries)),
        reranker=BedrockReranker(boto3.client("bedrock-agent-runtime", config=retries)),
    )
    study = StudyService(
        repository=PostgresStudyRepository(database_url),
        pages=storage,
        search=search,
        llm=StrandsStructuredLLM(boto_client_config=retries),
        model_id=NOVA_2_LITE,
    )
    return Container(
        catalog=PostgresCatalog(database_url),
        study=study,
        storage=storage,
        queue=SqsJobQueue(boto3.client("sqs"), os.environ["GENERATION_QUEUE_URL"]),
    )


def local_app():
    """Run on the developer's machine. With APP_ENV=local nothing but DeepSeek and Cognito is remote
    (see entrypoints/local.py); without it, the AWS services are used from the local process."""
    from entrypoints.local import is_local, local_api_app

    if is_local():
        return local_api_app()
    verifier = JwtVerifier(issuer=os.environ["COGNITO_ISSUER"], client_id=os.environ["COGNITO_CLIENT_ID"])
    return create_app(build_container(), jwt_verifier=verifier)


_handler = None


def lambda_handler(event, context):
    global _handler
    if _handler is None:
        _handler = Mangum(create_app(build_container()), lifespan="off")
    return _handler(event, context)
