from dataclasses import dataclass


@dataclass(frozen=True)
class SearchResult:
    chunk_id: str
    document_id: str
    document_name: str
    page_number: int
    content: str
    rrf_score: float
    semantic_similarity: float | None  # None when only the lexical search found the chunk
    rerank_score: float | None = None  # None when the reranker was not applied
