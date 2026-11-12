"""Wiring: everything runs on the developer's machine except the LLM API and Cognito.

| Piece        | Implementation                          |
|--------------|-----------------------------------------|
| LLM          | LLM_MODEL: DeepSeek API or Ollama       |
| Embeddings   | Ollama (OLLAMA_EMBED_MODEL, 512 d)      |
| Reranker     | none: hybrid (RRF) order                |
| Files        | LOCAL_STORAGE_DIR + POST /local-uploads |
| Jobs         | background threads in the API process  |
| Database     | Postgres from docker compose            |
| Users        | Cognito user pool                       |
"""

import os
from dataclasses import dataclass
from functools import cache

from adapters.bedrock.agent_runner import StrandsAgentRunner
from adapters.bedrock.structured_llm import StrandsStructuredLLM
from adapters.llm_models import DEFAULT_LLM_MODEL, DEFAULT_OLLAMA_URL, model_factory_from
from adapters.local.queue import InProcessJobQueue
from adapters.local.storage import LocalDocumentStorage
from adapters.ollama.embeddings import OllamaEmbedder
from adapters.pdf.pymupdf_reader import PyMuPdfReader
from adapters.postgres.catalog import PostgresCatalog
from adapters.postgres.conversations import PostgresConversationRepository
from adapters.postgres.documents import PostgresDocumentRepository
from adapters.postgres.search import PostgresSearchIndex
from adapters.postgres.study import PostgresStudyRepository
from entrypoints.api.app import Container, create_app
from entrypoints.api.auth import JwtVerifier
from entrypoints.api.local_uploads import LocalUploads
from services.agent_tools import AgentTools
from services.chat import ChatService
from services.ingestion import IngestionService
from services.search import SearchService
from services.study import StudyService


@dataclass(frozen=True)
class LocalServices:
    database_url: str
    model_factory: object
    storage: LocalDocumentStorage
    documents: PostgresDocumentRepository
    conversations: PostgresConversationRepository
    search: SearchService
    study: StudyService
    ingestion: IngestionService


@cache
def local_services() -> LocalServices:
    database_url = os.environ["DATABASE_URL"]
    llm_model = os.environ.get("LLM_MODEL", DEFAULT_LLM_MODEL)
    model_factory = model_factory_from(llm_model, os.environ)
    storage = LocalDocumentStorage(
        os.environ.get("LOCAL_STORAGE_DIR", ".local-data"), os.environ.get("PUBLIC_BASE_URL", "http://127.0.0.1:8000")
    )
    embedder = OllamaEmbedder(
        base_url=os.environ.get("OLLAMA_URL", DEFAULT_OLLAMA_URL),
        model=os.environ.get("OLLAMA_EMBED_MODEL", "embeddinggemma-2:270m"),
    )
    search = SearchService(PostgresSearchIndex(database_url), embedder, reranker=None)
    study = StudyService(
        repository=PostgresStudyRepository(database_url),
        pages=storage,
        search=search,
        llm=StrandsStructuredLLM(model_factory=model_factory),
        model_id=llm_model,
    )
    documents = PostgresDocumentRepository(database_url)
    return LocalServices(
        database_url=database_url,
        model_factory=model_factory,
        storage=storage,
        documents=documents,
        conversations=PostgresConversationRepository(database_url),
        search=search,
        study=study,
        ingestion=IngestionService(documents, storage, PyMuPdfReader(), embedder),
    )


def local_verifier() -> JwtVerifier:
    return JwtVerifier(issuer=os.environ["COGNITO_ISSUER"], client_id=os.environ["COGNITO_CLIENT_ID"])


def local_api_app():
    services = local_services()
    queue = InProcessJobQueue(
        {
            "summary": services.study.generate_summary,
            "flashcards": services.study.generate_flashcards,
            "quiz": services.study.generate_quiz,
        }
    )
    container = Container(
        catalog=PostgresCatalog(services.database_url), study=services.study, storage=services.storage, queue=queue
    )
    uploads = LocalUploads(services.storage, services.documents, services.ingestion)
    return create_app(container, jwt_verifier=local_verifier(), local_uploads=uploads)


def local_chat() -> ChatService:
    services = local_services()
    tools = AgentTools(services.conversations, services.search, services.study, services.conversations)
    return ChatService(services.conversations, StrandsAgentRunner(tools, model_factory=services.model_factory))
