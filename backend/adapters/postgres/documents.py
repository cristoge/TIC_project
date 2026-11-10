import psycopg

from domain.documents import Chunk


def vector_literal(values: list[float]) -> str:
    """pgvector text format, cast with ::vector in SQL."""
    return "[" + ",".join(repr(float(value)) for value in values) + "]"


class PostgresDocumentRepository:
    def __init__(self, conninfo: str):
        self.conninfo = conninfo

    def find_id_by_s3_key(self, s3_key: str) -> str | None:
        with psycopg.connect(self.conninfo) as conn:
            row = conn.execute("select id from documents where s3_key = %s", (s3_key,)).fetchone()
        return str(row[0]) if row else None

    def status_of(self, document_id: str) -> str | None:
        with psycopg.connect(self.conninfo) as conn:
            row = conn.execute("select status from documents where id = %s", (document_id,)).fetchone()
        return row[0] if row else None

    def mark_processing(self, document_id: str) -> None:
        self._set_status(document_id, "processing", None)

    def mark_failed(self, document_id: str, message: str) -> None:
        self._set_status(document_id, "failed", message)

    def save_chunks(
        self,
        document_id: str,
        chunks: list[Chunk],
        embeddings: list[list[float]],
        embedding_model: str,
        page_count: int,
    ) -> None:
        with psycopg.connect(self.conninfo) as conn, conn.transaction():
            conn.execute("delete from document_chunks where document_id = %s", (document_id,))
            with conn.cursor() as cursor:
                cursor.executemany(
                    "insert into document_chunks "
                    "(document_id, chunk_index, page_number, content, embedding, embedding_model) "
                    "values (%s, %s, %s, %s, %s::vector, %s)",
                    [
                        (document_id, chunk.index, chunk.page_number, chunk.content, vector_literal(vector), embedding_model)
                        for chunk, vector in zip(chunks, embeddings, strict=True)
                    ],
                )
            conn.execute(
                "update documents set status = 'ready', error_message = null, page_count = %s where id = %s",
                (page_count, document_id),
            )

    def _set_status(self, document_id: str, status: str, message: str | None) -> None:
        with psycopg.connect(self.conninfo) as conn:
            conn.execute(
                "update documents set status = %s, error_message = %s where id = %s",
                (status, message, document_id),
            )
