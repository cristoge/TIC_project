from adapters.postgres.search import PostgresSearchIndex


def _vector_literal(**components):
    values = [0.0] * 512
    for key, value in components.items():
        values[int(key[1:])] = value
    return "[" + ",".join(str(v) for v in values) + "]"


def _setup(conn):
    user_id = conn.execute(
        "insert into users (id, email) values (gen_random_uuid(), 'a@example.com') returning id"
    ).fetchone()[0]
    project_id = conn.execute(
        "insert into projects (user_id, name) values (%s, 'Biology') returning id", (user_id,)
    ).fetchone()[0]
    ids = {}
    for name, content, vector in (
        ("Tema2.pdf", "La meiosis produce gametos.", _vector_literal(d1=1.0)),
        ("Tema3.pdf", "La mitosis divide el núcleo.", _vector_literal(d0=1.0)),
    ):
        document_id = conn.execute(
            "insert into documents (project_id, name, s3_key, status) values (%s, %s, %s, 'ready') returning id",
            (project_id, name, name),
        ).fetchone()[0]
        conn.execute(
            "insert into document_chunks (document_id, chunk_index, page_number, content, embedding, embedding_model) "
            "values (%s, 0, 4, %s, %s::vector, 'test')",
            (document_id, content, vector),
        )
        ids[name] = str(document_id)
    return str(project_id), ids


QUERY = [1.0] + [0.0] * 511


def test_hybrid_search_maps_rows_to_results(conn, database):
    project_id, ids = _setup(conn)

    results = PostgresSearchIndex(database).hybrid_search(project_id, "mitosis", QUERY, candidates=40)

    top = results[0]
    assert (top.document_id, top.document_name, top.page_number, top.content) == (
        ids["Tema3.pdf"],
        "Tema3.pdf",
        4,
        "La mitosis divide el núcleo.",
    )
    assert top.semantic_similarity == 1.0
    assert top.rerank_score is None
    assert [r.document_name for r in results] == ["Tema3.pdf", "Tema2.pdf"]


def test_hybrid_search_can_be_limited_to_some_documents(conn, database):
    project_id, ids = _setup(conn)

    results = PostgresSearchIndex(database).hybrid_search(
        project_id, "mitosis", QUERY, candidates=40, document_ids=[ids["Tema2.pdf"]]
    )

    assert [r.document_name for r in results] == ["Tema2.pdf"]


def test_blank_query_text_gives_the_pure_semantic_order(conn, database):
    project_id, _ = _setup(conn)
    meiosis_vector = [0.0, 1.0] + [0.0] * 510

    results = PostgresSearchIndex(database).hybrid_search(project_id, "", meiosis_vector, candidates=40)

    assert [r.document_name for r in results] == ["Tema2.pdf", "Tema3.pdf"]
