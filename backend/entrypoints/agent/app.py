"""AgentCore Runtime entrypoint for the chat agent.

Deployed: AgentCore validates the Cognito ID token (inbound JWT authorizer) and
passes the Authorization header through (request header allowlist); set
AUTH_VALIDATED_UPSTREAM=true.
Local: `uv run python -m entrypoints.agent.app` serves POST /invocations on :8080;
COGNITO_ISSUER and COGNITO_CLIENT_ID make it verify tokens itself. It listens on
127.0.0.1 unless AGENT_HOST says otherwise (0.0.0.0 lets a phone or simulator reach it).

Environment: DATABASE_URL, DOCUMENTS_BUCKET.
"""

import os
from functools import cache

from bedrock_agentcore.runtime import BedrockAgentCoreApp

from entrypoints.agent.handler import identify, run_chat

app = BedrockAgentCoreApp()


@cache
def _chat_and_verifier():
    from entrypoints.local import is_local, local_chat, local_verifier

    if is_local():
        return local_chat(), local_verifier()

    import boto3
    from botocore.config import Config

    from adapters.bedrock.agent_runner import StrandsAgentRunner
    from adapters.bedrock.embeddings import TitanEmbedder
    from adapters.bedrock.rerank import BedrockReranker
    from adapters.bedrock.structured_llm import NOVA_2_LITE, StrandsStructuredLLM
    from adapters.postgres.conversations import PostgresConversationRepository
    from adapters.postgres.search import PostgresSearchIndex
    from adapters.postgres.study import PostgresStudyRepository
    from adapters.s3.storage import S3DocumentStorage
    from entrypoints.api.auth import JwtVerifier
    from services.agent_tools import AgentTools
    from services.chat import ChatService
    from services.search import SearchService
    from services.study import StudyService

    database_url = os.environ["DATABASE_URL"]
    retries = Config(retries={"mode": "adaptive", "total_max_attempts": 8})
    conversations = PostgresConversationRepository(database_url)
    search = SearchService(
        index=PostgresSearchIndex(database_url),
        embedder=TitanEmbedder(boto3.client("bedrock-runtime", config=retries)),
        reranker=BedrockReranker(boto3.client("bedrock-agent-runtime", config=retries)),
    )
    study = StudyService(
        repository=PostgresStudyRepository(database_url),
        pages=S3DocumentStorage(boto3.client("s3"), os.environ["DOCUMENTS_BUCKET"]),
        search=search,
        llm=StrandsStructuredLLM(boto_client_config=retries),
        model_id=NOVA_2_LITE,
    )
    tools = AgentTools(documents=conversations, search=search, study=study, status=conversations)
    chat = ChatService(conversations, StrandsAgentRunner(tools, boto_client_config=retries))

    verifier = None
    if os.environ.get("AUTH_VALIDATED_UPSTREAM") != "true":
        verifier = JwtVerifier(issuer=os.environ["COGNITO_ISSUER"], client_id=os.environ["COGNITO_CLIENT_ID"])
    return chat, verifier


@app.entrypoint
async def invoke(payload, context):
    chat, verifier = _chat_and_verifier()
    user = identify(context.request_headers or {}, verifier)
    async for event in run_chat(chat, user, payload):
        yield event


if __name__ == "__main__":
    app.run(host=os.environ.get("AGENT_HOST"))
