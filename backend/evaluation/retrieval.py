"""Retrieval metrics: did the search return the chunk that answers the question?"""

from dataclasses import dataclass

from domain.search import SearchResult


@dataclass(frozen=True)
class Expected:
    """Where the answer lives. Match by page, by a text snippet, or both."""

    document: str
    page: int | None = None
    contains: str | None = None

    def matches(self, result: SearchResult) -> bool:
        if result.document_name != self.document:
            return False
        if self.page is not None and result.page_number != self.page:
            return False
        if self.contains is not None and self.contains.lower() not in result.content.lower():
            return False
        return True


def first_relevant_rank(results: list[SearchResult], expected: Expected) -> int | None:
    """1-based rank of the first relevant result, or None if none is relevant."""
    for rank, result in enumerate(results, start=1):
        if expected.matches(result):
            return rank
    return None


def summarize(ranks: list[int | None], k: int) -> dict:
    """Hit rate at k (share of questions answered in the top k) and mean reciprocal rank."""
    hits = sum(1 for rank in ranks if rank is not None and rank <= k)
    reciprocal = sum(1 / rank for rank in ranks if rank is not None)
    return {"questions": len(ranks), "hit_rate": hits / len(ranks), "mrr": reciprocal / len(ranks)}
