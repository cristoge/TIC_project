"""Hybrid search (lexical + semantic, fused with RRF) followed by a reranker."""

import logging
from dataclasses import dataclass, replace
from typing import Protocol

from domain.search import SearchResult
from services.ingestion import Embedder

logger = logging.getLogger(__name__)


class SearchIndex(Protocol):
    def hybrid_search(
        self,
        project_id: str,
        query_text: str,
        query_embedding: list[float],
        candidates: int,
        document_ids: list[str] | None = None,
    ) -> list[SearchResult]: ...


class Reranker(Protocol):
    def rerank(self, query: str, documents: list[str], top_n: int) -> list[tuple[int, float]]:
        """Return (index into documents, relevance score), most relevant first."""
        ...


@dataclass
class SearchService:
    index: SearchIndex
    embedder: Embedder
    reranker: Reranker
    candidates: int = 40
    top_k: int = 8

    def search(self, project_id: str, query: str, document_ids: list[str] | None = None) -> list[SearchResult]:
        """Retrieve wide with the hybrid index, then let the reranker keep the best top_k.

        If the reranker fails the hybrid (RRF) order is used, so search never
        breaks because of it.
        """
        if not query.strip():
            raise ValueError("The search query is empty.")
        embedding = self.embedder.embed([query])[0]
        candidates = self.index.hybrid_search(project_id, query, embedding, self.candidates, document_ids)
        if not candidates:
            return []
        try:
            ranking = self.reranker.rerank(query, [c.content for c in candidates], self.top_k)
        except Exception:
            logger.warning("Reranker failed; falling back to the hybrid order", exc_info=True)
            return candidates[: self.top_k]
        return [replace(candidates[index], rerank_score=score) for index, score in ranking]
