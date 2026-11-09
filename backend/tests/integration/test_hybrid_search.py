import math

import pytest

DIMENSIONS = 512


def _vector(**components):
    """Build a 512-d vector literal from {'d0': 1.0, 'd1': 0.5, ...}."""
    values = [0.0] * DIMENSIONS
    for key, value in components.items():
        values[int(key[1:])] = value
    return "[" + ",".join(str(v) for v in values) + "]"


QUERY_VECTOR = _vector(d0=1.0)


def _create_project(conn, email="owner@example.com"):
    user_id = conn.execute(
        "insert into users (id, email) values (gen_random_uuid(), %s) returning id", (email,)
    ).fetchone()[0]
    return conn.execute(
        "insert into projects (user_id, name) values (%s, 'Biology') returning id", (user_id,)
    ).fetchone()[0]


def _create_document(conn, project_id, name, status="ready"):
    return conn.execute(
        "insert into documents (project_id, name, s3_key, status) "
        "values (%s, %s, %s, %s) returning id",
        (project_id, name, f"{project_id}/{name}", status),
    ).fetchone()[0]


def _add_chunk(conn, document_id, index, content, vector, page=1):
    return conn.execute(
        "insert into document_chunks "
        "(document_id, chunk_index, page_number, content, embedding, embedding_model) "
        "values (%s, %s, %s, %s, %s::vector, 'test') returning id",
        (document_id, index, page, content, vector),
    ).fetchone()[0]


def _search(conn, project_id, text, vector=QUERY_VECTOR, candidates=40):
    return conn.execute(
        "select chunk_id, document_name, page_number, content, rrf_score, semantic_similarity "
        "from hybrid_search(%s, %s, %s::vector, %s)",
        (project_id, text, vector, candidates),
    ).fetchall()


def test_lexical_match_lifts_a_chunk_above_a_semantically_closer_one(conn):
    project_id = _create_project(conn)
    document_id = _create_document(conn, project_id, "Tema3.pdf")
    both = _add_chunk(conn, document_id, 0, "La mitosis divide el núcleo celular.", _vector(d0=1.0))
    lexical = _add_chunk(conn, document_id, 1, "Fases de la mitosis: profase y metafase.", _vector(d1=1.0))
    semantic = _add_chunk(
        conn, document_id, 2, "El ciclo de vida de los organismos.", _vector(d0=0.5, d1=math.sqrt(0.75))
    )

    results = _search(conn, project_id, "mitosis")

    assert [row[0] for row in results] == [both, lexical, semantic]


def test_results_carry_document_name_page_and_semantic_similarity(conn):
    project_id = _create_project(conn)
    document_id = _create_document(conn, project_id, "Tema3.pdf")
    _add_chunk(conn, document_id, 0, "La mitosis divide el núcleo.", _vector(d0=1.0), page=12)

    (_, document_name, page, content, rrf_score, similarity), = _search(conn, project_id, "mitosis")

    assert (document_name, page, content) == ("Tema3.pdf", 12, "La mitosis divide el núcleo.")
    assert similarity == pytest.approx(1.0)
    assert rrf_score == pytest.approx(2 / 61)


def test_lexical_search_matches_word_variants(conn):
    project_id = _create_project(conn)
    document_id = _create_document(conn, project_id, "Tema1.pdf")
    _add_chunk(conn, document_id, 0, "Texto sin relación.", _vector(d0=1.0))
    target = _add_chunk(conn, document_id, 1, "La célula es la unidad básica.", _vector(d1=1.0))

    results = _search(conn, project_id, "células", candidates=1)

    assert target in [row[0] for row in results]


def test_lexical_search_needs_only_one_of_the_query_terms(conn):
    project_id = _create_project(conn)
    document_id = _create_document(conn, project_id, "Tema2.pdf")
    _add_chunk(conn, document_id, 0, "Texto sin relación.", _vector(d0=1.0))
    target = _add_chunk(conn, document_id, 1, "La meiosis produce gametos.", _vector(d1=1.0))

    results = _search(conn, project_id, "¿qué dice el tema sobre la meiosis?", candidates=1)

    assert target in [row[0] for row in results]


def test_query_with_only_stopwords_falls_back_to_semantic_results(conn):
    project_id = _create_project(conn)
    document_id = _create_document(conn, project_id, "Tema1.pdf")
    chunk = _add_chunk(conn, document_id, 0, "La mitosis divide el núcleo.", _vector(d0=1.0))

    results = _search(conn, project_id, "de la")

    assert [row[0] for row in results] == [chunk]


def test_only_ready_documents_of_the_same_project_are_searched(conn):
    project_id = _create_project(conn)
    other_project_id = _create_project(conn, email="other@example.com")
    ready = _create_document(conn, project_id, "Ready.pdf")
    processing = _create_document(conn, project_id, "Processing.pdf", status="processing")
    foreign = _create_document(conn, other_project_id, "Foreign.pdf")
    expected = _add_chunk(conn, ready, 0, "La mitosis divide el núcleo.", _vector(d0=1.0))
    _add_chunk(conn, processing, 0, "La mitosis en proceso.", _vector(d0=1.0))
    _add_chunk(conn, foreign, 0, "La mitosis de otro usuario.", _vector(d0=1.0))

    results = _search(conn, project_id, "mitosis")

    assert [row[0] for row in results] == [expected]


def test_candidates_limit_each_search_list(conn):
    project_id = _create_project(conn)
    document_id = _create_document(conn, project_id, "Tema1.pdf")
    for index in range(5):
        _add_chunk(conn, document_id, index, f"Texto número {index}.", _vector(d0=1.0, d1=float(index)))

    results = _search(conn, project_id, "nada", candidates=2)

    assert len(results) == 2
