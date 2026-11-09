from domain.search import SearchResult
from evaluation.retrieval import Expected, first_relevant_rank, summarize


def _result(document, page, content="text"):
    return SearchResult(
        chunk_id="c",
        document_id="d",
        document_name=document,
        page_number=page,
        content=content,
        rrf_score=0.0,
        semantic_similarity=None,
    )


def test_relevant_chunk_matches_document_and_page():
    results = [_result("Tema2.pdf", 4), _result("Tema3.pdf", 12), _result("Tema3.pdf", 13)]

    assert first_relevant_rank(results, Expected(document="Tema3.pdf", page=12)) == 2


def test_relevant_chunk_can_be_identified_by_a_text_snippet():
    results = [_result("Tema3.pdf", 1, "La profase empieza"), _result("Tema3.pdf", 1, "En la metafase los cromosomas")]

    assert first_relevant_rank(results, Expected(document="Tema3.pdf", contains="metafase")) == 2


def test_missing_relevant_chunk_has_no_rank():
    assert first_relevant_rank([_result("Tema2.pdf", 4)], Expected(document="Tema3.pdf", page=12)) is None


def test_summarize_reports_hit_rate_at_k_and_mean_reciprocal_rank():
    ranks = [1, 3, None, 2]

    summary = summarize(ranks, k=2)

    assert summary == {"questions": 4, "hit_rate": 0.5, "mrr": (1 + 1 / 3 + 0 + 1 / 2) / 4}
