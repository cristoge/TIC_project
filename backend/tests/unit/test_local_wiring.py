"""The API and the chat are built with the local adapters, without any network call."""

import pytest
from strands.models.openai import OpenAIModel

import entrypoints.agent.app as agent_app
from adapters.local.queue import InProcessJobQueue
from adapters.local.storage import LocalDocumentStorage
from adapters.ollama.embeddings import OllamaEmbedder
from entrypoints import local
from entrypoints.api.auth import JwtVerifier


@pytest.fixture
def local_env(monkeypatch, tmp_path):
    env = {
        "DATABASE_URL": "postgresql://study:study@localhost:5433/study",
        "DEEPSEEK_API_KEY": "test-key",
        "LOCAL_STORAGE_DIR": str(tmp_path),
        "COGNITO_ISSUER": "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_T",
        "COGNITO_CLIENT_ID": "client",
    }
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    local.local_services.cache_clear()
    agent_app._chat_and_verifier.cache_clear()
    yield tmp_path
    local.local_services.cache_clear()
    agent_app._chat_and_verifier.cache_clear()


def test_local_api_uses_local_storage_in_process_jobs_and_the_upload_route(local_env):
    app = local.local_api_app()

    paths = {route.path for route in app.routes}
    assert "/local-uploads" in paths
    assert isinstance(app.state.jwt_verifier, JwtVerifier)
    assert isinstance(app.state.local_uploads.storage, LocalDocumentStorage)
    services = local.local_services()
    assert services.storage.root == local_env.resolve()
    assert isinstance(services.search.embedder, OllamaEmbedder)
    assert services.search.reranker is None
    assert services.study.model_id == "deepseek/deepseek-flash"


def test_the_upload_route_exists_only_in_local_mode():
    from entrypoints.api.app import Container, create_app

    app = create_app(Container(catalog=None, study=None, storage=None, queue=None))

    assert "/local-uploads" not in {route.path for route in app.routes}


def test_local_models_are_deepseek(local_env):
    model = local.local_services().model_factory(0.2)

    assert isinstance(model, OpenAIModel)
    assert model.get_config()["params"]["temperature"] == 0.2


def test_local_agent_gets_the_local_chat_and_verifies_tokens_itself(local_env):
    chat, verifier = agent_app._chat_and_verifier()

    assert isinstance(verifier, JwtVerifier)
    assert isinstance(chat.runner.model_factory(0.2), OpenAIModel)


def test_the_api_queue_runs_generations_in_process(local_env):
    queue = local.local_api_app().state.container.queue

    assert isinstance(queue, InProcessJobQueue)
    assert set(queue.runners) == {"summary", "flashcards", "quiz"}


def test_without_a_token_verifier_every_request_is_rejected():
    from fastapi.testclient import TestClient

    from entrypoints.api.app import Container, create_app

    app = create_app(Container(catalog=None, study=None, storage=None, queue=None))

    response = TestClient(app).get("/me", headers={"Authorization": "Bearer anything"})

    assert response.status_code == 401


def test_llm_model_switches_every_llm_to_ollama_without_a_deepseek_key(local_env, monkeypatch):
    from strands.models.ollama import OllamaModel

    monkeypatch.delenv("DEEPSEEK_API_KEY")
    monkeypatch.setenv("LLM_MODEL", "ollama/qwen3:8b")
    local.local_services.cache_clear()

    services = local.local_services()
    chat, _ = agent_app._chat_and_verifier()

    assert services.study.model_id == "ollama/qwen3:8b"
    assert isinstance(services.study.llm.model_factory(0.2), OllamaModel)
    assert isinstance(chat.runner.model_factory(0.2), OllamaModel)
