"""Local adapters: DeepSeek model factory, Ollama embeddings, local files, in-process queue."""

import json
from concurrent.futures import Future

import httpx
import pytest
from strands.models.openai import OpenAIModel

from adapters.llm_models import deepseek_model_factory, model_factory_from
from adapters.local.queue import InProcessJobQueue
from adapters.local.storage import LocalDocumentStorage
from adapters.ollama.embeddings import OllamaEmbedder
from domain.documents import Page
from domain.search import SearchResult
from services.search import SearchService

# --- model factories -------------------------------------------------------------


def test_deepseek_factory_builds_an_openai_compatible_model_with_the_requested_temperature():
    model = deepseek_model_factory(api_key="secret", model_id="deepseek-flash")(0.7)

    assert isinstance(model, OpenAIModel)
    assert model.client_args == {"api_key": "secret", "base_url": "https://api.deepseek.com"}
    assert model.get_config() == {
        "model_id": "deepseek-flash",
        "params": {"temperature": 0.7, "extra_body": {"thinking": {"type": "disabled"}}},
    }


def test_a_deepseek_spec_builds_deepseek_with_the_api_key():
    model = model_factory_from("deepseek/deepseek-flash", {"DEEPSEEK_API_KEY": "secret"})(0.3)

    assert isinstance(model, OpenAIModel)
    assert model.client_args["api_key"] == "secret"
    assert model.get_config()["model_id"] == "deepseek-flash"
    assert model.get_config()["params"]["temperature"] == 0.3


def test_an_ollama_spec_builds_an_ollama_model_on_the_configured_server():
    from strands.models.ollama import OllamaModel

    model = model_factory_from("ollama/qwen3:8b", {"OLLAMA_URL": "http://desktop:11434"})(0.2)

    assert isinstance(model, OllamaModel)
    assert model.host == "http://desktop:11434"
    assert model.get_config()["model_id"] == "qwen3:8b"
    assert model.get_config()["temperature"] == 0.2


def test_ollama_uses_the_local_server_by_default_and_keeps_slashes_in_the_model_name():
    model = model_factory_from("ollama/hf.co/user/model:Q4", {})(0.2)

    assert model.host == "http://localhost:11434"
    assert model.get_config()["model_id"] == "hf.co/user/model:Q4"


@pytest.mark.parametrize("spec", ["deepseek-flash", "openai/gpt", "ollama/", "/qwen3"])
def test_an_unknown_or_incomplete_spec_is_rejected_with_the_expected_format(spec):
    with pytest.raises(ValueError, match="LLM_MODEL must look like 'deepseek/<model>' or 'ollama/<model>'"):
        model_factory_from(spec, {"DEEPSEEK_API_KEY": "secret"})


def test_deepseek_without_an_api_key_says_what_is_missing():
    with pytest.raises(ValueError, match="DEEPSEEK_API_KEY"):
        model_factory_from("deepseek/deepseek-flash", {})


# --- Ollama embeddings ------------------------------------------------------------


def _ollama(handler):
    return OllamaEmbedder(
        base_url="http://ollama:11434",
        model="embeddinggemma-2:270m",
        batch_size=2,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )


def test_ollama_embeds_in_batches_keeping_the_order():
    requests = []

    def handler(request):
        body = json.loads(request.content)
        requests.append((request.url.path, body))
        return httpx.Response(200, json={"embeddings": [[float(len(text))] for text in body["input"]]})

    vectors = _ollama(handler).embed(["a", "bb", "ccc"])

    assert vectors == [[1.0], [2.0], [3.0]]
    assert requests == [
        ("/api/embed", {"model": "embeddinggemma-2:270m", "input": ["a", "bb"], "dimensions": 512}),
        ("/api/embed", {"model": "embeddinggemma-2:270m", "input": ["ccc"], "dimensions": 512}),
    ]


def test_ollama_errors_are_raised():
    embedder = _ollama(lambda request: httpx.Response(404, json={"error": "model not found"}))

    with pytest.raises(httpx.HTTPStatusError):
        embedder.embed(["a"])


def test_ollama_model_id_names_the_provider():
    assert _ollama(lambda r: httpx.Response(200)).model_id == "ollama/embeddinggemma-2:270m"


# --- search without a reranker ----------------------------------------------------------


class Index:
    def __init__(self, results):
        self.results = results

    def hybrid_search(self, project_id, query_text, query_embedding, candidates, document_ids=None):
        return self.results


class Embedder:
    model_id = "fake"

    def embed(self, texts):
        return [[0.0] for _ in texts]


def test_search_without_reranker_keeps_the_hybrid_order():
    results = [SearchResult(f"c{n}", "d", "D.pdf", n, "t", 0.0, 0.5) for n in range(12)]

    assert SearchService(Index(results), Embedder(), reranker=None, top_k=8).search("p", "q") == results[:8]


# --- local files ------------------------------------------------------------------


def test_local_storage_keeps_pdfs_and_page_texts_on_disk(tmp_path):
    storage = LocalDocumentStorage(tmp_path, public_base_url="http://127.0.0.1:8000")
    key = "users/u/projects/p/d.pdf"

    upload = storage.create_upload(key, max_bytes=1000)
    storage.save_upload(key, b"%PDF-1.7")
    storage.save_pages("d", [Page(1, "Uno"), Page(2, "Dos")])

    assert upload == {"url": "http://127.0.0.1:8000/local-uploads", "fields": {"key": key}}
    assert storage.read_pdf(key) == b"%PDF-1.7"
    assert storage.load_pages("d") == [Page(1, "Uno"), Page(2, "Dos")]

    storage.delete_document_objects("d", key)

    assert not (tmp_path / key).exists()
    assert not (tmp_path / "documents" / "d" / "pages.json").exists()


@pytest.mark.parametrize("key", ["../outside.pdf", "/etc/passwd", "users/../../x.pdf"])
def test_local_storage_refuses_keys_that_escape_its_folder(tmp_path, key):
    storage = LocalDocumentStorage(tmp_path / "data", public_base_url="http://x")

    with pytest.raises(ValueError):
        storage.save_upload(key, b"%PDF")


# --- in-process queue -----------------------------------------------------------------


class InlineExecutor:
    def submit(self, fn, *args):
        future = Future()
        try:
            future.set_result(fn(*args))
        except Exception as error:  # noqa: BLE001 - the queue must survive a failing job
            future.set_exception(error)
        return future


def test_in_process_queue_runs_the_matching_generation():
    calls = []
    runners = {"summary": lambda i: calls.append(("summary", i)), "quiz": lambda i: calls.append(("quiz", i))}

    queue = InProcessJobQueue(runners, executor=InlineExecutor())
    queue.enqueue("quiz", "q1")
    queue.enqueue("summary", "s1")

    assert calls == [("quiz", "q1"), ("summary", "s1")]


def test_a_failing_job_does_not_break_the_queue():
    def boom(generation_id):
        raise RuntimeError("model down")

    queue = InProcessJobQueue({"summary": boom}, executor=InlineExecutor())

    queue.enqueue("summary", "s1")  # no exception reaches the API request
