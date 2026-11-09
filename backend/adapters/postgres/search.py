import psycopg

from adapters.postgres.documents import vector_literal
from domain.search import SearchResult


class PostgresSearchIndex:
    def __init__(self, conninfo: str):
        self.conninfo = conninfo

    def hybrid_search(
        self,
        project_id: str,
        query_text: str,
        query_embedding: list[float],
        candidates: int,
        document_ids: list[str] | None = None,
    ) -> list[SearchResult]:
        with psycopg.connect(self.conninfo) as conn:
            rows = conn.execute(
                "select chunk_id, document_id, document_name, page_number, content, rrf_score, semantic_similarity "
                "from hybrid_search(%s, %s, %s::vector, %s, 60, %s::uuid[])",
                (project_id, query_text, vector_literal(query_embedding), candidates, document_ids),
            ).fetchall()
        return [
            SearchResult(
                chunk_id=str(chunk_id),
                document_id=str(document_id),
                document_name=document_name,
                page_number=page_number,
                content=content,
                rrf_score=rrf_score,
                semantic_similarity=similarity,
            )
            for chunk_id, document_id, document_name, page_number, content, rrf_score, similarity in rows
        ]
