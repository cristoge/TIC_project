from dataclasses import replace

import pytest

from domain.search import SearchResult
from services.search import SearchService


def _result(n):
    return SearchResult(
        chunk_id=f"c{n}",
        document_id="d1",
        document_name="Tema3.pdf",
        page_number=n,
        content=f"content {n}",
        rrf_score=1 / (60 + n),
        semantic_similarity=0.5,
    )


class FakeIndex:
    def __init__(self, results):
        self.results = results
        self.calls = []

    def hybrid_search(self, project_id, query_text, query_embedding, candidates, document_ids=None):
        self.calls.append((project_id, query_text, query_embedding, candidates, document_ids))
        return self.results


class FakeEmbedder:
    model_id = "fake"

    def embed(self, texts):
        return [[0.1, 0.2] for _ in texts]


class FakeReranker:
    def __init__(self, ranking=None, error=None):
        self.ranking = ranking or []
        self.error = error
        self.calls = []

    def rerank(self, query, documents, top_n):
        self.calls.append((query, documents, top_n))
        if self.error:
            raise self.error
        return self.ranking


def test_search_returns_the_reranked_top_results_with_their_scores():
    candidates = [_result(n) for n in range(1, 6)]
    reranker = FakeReranker(ranking=[(3, 0.9), (0, 0.7)])
    service = SearchService(FakeIndex(candidates), FakeEmbedder(), reranker, candidates=40, top_k=2)

    results = service.search("project-1", "mitosis")

    assert results == [replace(candidates[3], rerank_score=0.9), replace(candidates[0], rerank_score=0.7)]
    assert reranker.calls == [("mitosis", [c.content for c in candidates], 2)]


def test_search_passes_the_query_embedding_candidates_and_document_filter_to_the_index():
    index = FakeIndex([])
    service = SearchService(index, FakeEmbedder(), FakeReranker(), candidates=40, top_k=8)

    service.search("project-1", "mitosis", document_ids=["d1"])

    assert index.calls == [("project-1", "mitosis", [0.1, 0.2], 40, ["d1"])]


def test_search_without_candidates_skips_the_reranker():
    reranker = FakeReranker()
    service = SearchService(FakeIndex([]), FakeEmbedder(), reranker)

    assert service.search("project-1", "mitosis") == []
    assert reranker.calls == []


def test_reranker_failure_falls_back_to_the_hybrid_order():
    candidates = [_result(n) for n in range(1, 12)]
    service = SearchService(
        FakeIndex(candidates), FakeEmbedder(), FakeReranker(error=RuntimeError("throttled")), top_k=8
    )

    results = service.search("project-1", "mitosis")

    assert results == candidates[:8]


def test_search_rejects_an_empty_query():
    service = SearchService(FakeIndex([]), FakeEmbedder(), FakeReranker())

    with pytest.raises(ValueError):
        service.search("project-1", "   ")
