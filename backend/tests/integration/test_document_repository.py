from adapters.postgres.documents import PostgresDocumentRepository
from domain.documents import Chunk


def _document(conn, s3_key="users/u/projects/p/doc.pdf"):
    user_id = conn.execute(
        "insert into users (id, email) values (gen_random_uuid(), 'a@example.com') returning id"
    ).fetchone()[0]
    project_id = conn.execute(
        "insert into projects (user_id, name) values (%s, 'Biology') returning id", (user_id,)
    ).fetchone()[0]
    return str(
        conn.execute(
            "insert into documents (project_id, name, s3_key) values (%s, 'doc.pdf', %s) returning id",
            (project_id, s3_key),
        ).fetchone()[0]
    )


def _status(conn, document_id):
    return conn.execute(
        "select status, error_message, page_count from documents where id = %s", (document_id,)
    ).fetchone()


def _vector(value):
    return [value] + [0.0] * 511


def test_find_id_by_s3_key(conn, database):
    document_id = _document(conn)
    repository = PostgresDocumentRepository(database)

    assert repository.find_id_by_s3_key("users/u/projects/p/doc.pdf") == document_id
    assert repository.find_id_by_s3_key("missing.pdf") is None


def test_save_chunks_stores_them_and_marks_the_document_ready(conn, database):
    document_id = _document(conn)
    repository = PostgresDocumentRepository(database)
    repository.mark_processing(document_id)

    repository.save_chunks(
        document_id,
        [Chunk(0, 1, "Mitosis divides."), Chunk(1, 2, "Meiosis produces.")],
        [_vector(1.0), _vector(0.5)],
        "amazon.titan-embed-text-v2:0",
        page_count=2,
    )

    rows = conn.execute(
        "select chunk_index, page_number, content, embedding_model, vector_dims(embedding) "
        "from document_chunks where document_id = %s order by chunk_index",
        (document_id,),
    ).fetchall()
    assert rows == [
        (0, 1, "Mitosis divides.", "amazon.titan-embed-text-v2:0", 512),
        (1, 2, "Meiosis produces.", "amazon.titan-embed-text-v2:0", 512),
    ]
    assert _status(conn, document_id) == ("ready", None, 2)


def test_saving_again_replaces_the_previous_chunks(conn, database):
    document_id = _document(conn)
    repository = PostgresDocumentRepository(database)
    repository.save_chunks(document_id, [Chunk(0, 1, "Old"), Chunk(1, 1, "Old 2")], [_vector(1.0)] * 2, "m", 1)

    repository.save_chunks(document_id, [Chunk(0, 1, "New")], [_vector(1.0)], "m", 1)

    contents = conn.execute(
        "select content from document_chunks where document_id = %s", (document_id,)
    ).fetchall()
    assert contents == [("New",)]


def test_mark_failed_then_processing_clears_the_error(conn, database):
    document_id = _document(conn)
    repository = PostgresDocumentRepository(database)

    repository.mark_failed(document_id, "Something broke.")
    assert _status(conn, document_id) == ("failed", "Something broke.", None)

    repository.mark_processing(document_id)
    assert _status(conn, document_id) == ("processing", None, None)
