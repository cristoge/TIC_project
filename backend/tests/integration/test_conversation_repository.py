from adapters.postgres.conversations import PostgresConversationRepository
from services.agent_tools import Source
from services.chat import HistoryMessage


def _setup(conn):
    user_id = conn.execute(
        "insert into users (id, email) values (gen_random_uuid(), 'a@example.com') returning id"
    ).fetchone()[0]
    project_id = conn.execute(
        "insert into projects (user_id, name) values (%s, 'Biology') returning id", (user_id,)
    ).fetchone()[0]
    document_id = conn.execute(
        "insert into documents (project_id, name, s3_key, status, page_count) values (%s, 'Tema3.pdf', 'k', 'ready', 20) "
        "returning id",
        (project_id,),
    ).fetchone()[0]
    chunk_id = conn.execute(
        "insert into document_chunks (document_id, chunk_index, page_number, content, embedding, embedding_model) "
        "values (%s, 0, 12, 'Mitosis', array_fill(0, array[512])::vector, 'm') returning id",
        (document_id,),
    ).fetchone()[0]
    conversation_id = conn.execute(
        "insert into conversations (project_id) values (%s) returning id", (project_id,)
    ).fetchone()[0]
    return str(user_id), str(project_id), str(document_id), str(chunk_id), str(conversation_id)


def _message(conn, conversation_id, role, content, minutes_ago):
    conn.execute(
        "insert into chat_messages (conversation_id, role, content, created_at) "
        "values (%s, %s, %s, now() - %s * interval '1 minute')",
        (conversation_id, role, content, minutes_ago),
    )


def test_project_of_is_owner_scoped(conn, database):
    user_id, project_id, _, _, conversation_id = _setup(conn)
    repository = PostgresConversationRepository(database)

    assert repository.project_of(user_id, conversation_id) == project_id
    assert repository.project_of("00000000-0000-0000-0000-000000000000", conversation_id) is None


def test_recent_messages_keep_the_newest_within_the_budget_in_order_starting_with_the_user(conn, database):
    _, _, _, _, conversation_id = _setup(conn)
    _message(conn, conversation_id, "user", "u" * 50, 10)
    _message(conn, conversation_id, "assistant", "a" * 50, 9)
    _message(conn, conversation_id, "user", "second question", 8)
    _message(conn, conversation_id, "assistant", "second answer", 7)

    history = PostgresConversationRepository(database).recent_messages(conversation_id, max_chars=80)

    assert history == [HistoryMessage("user", "second question"), HistoryMessage("assistant", "second answer")]


def test_recent_messages_never_start_with_an_assistant_message(conn, database):
    _, _, _, _, conversation_id = _setup(conn)
    _message(conn, conversation_id, "user", "u" * 50, 10)
    _message(conn, conversation_id, "assistant", "short", 9)

    history = PostgresConversationRepository(database).recent_messages(conversation_id, max_chars=20)

    assert history == []


def test_save_turn_stores_both_messages_sources_artifacts_and_a_title(conn, database):
    _, _, document_id, chunk_id, conversation_id = _setup(conn)
    quiz_id = conn.execute(
        "insert into quizzes (document_id, requested_count, model) values (%s, 3, 'nova') returning id", (document_id,)
    ).fetchone()[0]
    repository = PostgresConversationRepository(database)

    message_id = repository.save_turn(
        conversation_id,
        "¿Qué es la mitosis? Explícalo con detalle para el examen de mañana por favor",
        "Una división [1].",
        [Source(1, chunk_id, document_id, "Tema3.pdf", 12)],
        {"quiz": str(quiz_id)},
    )

    rows = conn.execute(
        "select role, content, quiz_id from chat_messages where conversation_id = %s order by created_at",
        (conversation_id,),
    ).fetchall()
    assert [(r[0], r[1]) for r in rows] == [
        ("user", "¿Qué es la mitosis? Explícalo con detalle para el examen de mañana por favor"),
        ("assistant", "Una división [1]."),
    ]
    assert rows[1][2] == quiz_id
    assert conn.execute("select message_id::text, chunk_id::text, rank from message_sources").fetchall() == [
        (message_id, chunk_id, 1)
    ]
    title = conn.execute("select title from conversations where id = %s", (conversation_id,)).fetchone()[0]
    assert title == "¿Qué es la mitosis? Explícalo con detalle para el examen de…"


def test_saved_turns_come_back_in_order_as_history(conn, database):
    _, _, _, _, conversation_id = _setup(conn)
    repository = PostgresConversationRepository(database)
    repository.save_turn(conversation_id, "Q1", "A1", [], {})
    repository.save_turn(conversation_id, "Q2", "A2", [], {})

    history = repository.recent_messages(conversation_id, max_chars=1000)

    assert [(m.role, m.content) for m in history] == [
        ("user", "Q1"), ("assistant", "A1"), ("user", "Q2"), ("assistant", "A2")
    ]


def test_save_turn_keeps_an_existing_title(conn, database):
    _, _, _, _, conversation_id = _setup(conn)
    conn.execute("update conversations set title = 'Mitosis' where id = %s", (conversation_id,))

    PostgresConversationRepository(database).save_turn(conversation_id, "Otra pregunta", "Respuesta", [], {})

    assert conn.execute("select title from conversations where id = %s", (conversation_id,)).fetchone()[0] == "Mitosis"


def test_list_documents_of_project_and_generation_status(conn, database):
    _, project_id, document_id, _, _ = _setup(conn)
    deck_id = conn.execute(
        "insert into flashcard_decks (document_id, requested_count, model, status, error_message) "
        "values (%s, 3, 'nova', 'failed', 'No valid flashcards could be generated.') returning id",
        (document_id,),
    ).fetchone()[0]
    repository = PostgresConversationRepository(database)

    assert repository.list_documents_of_project(project_id) == [
        {"id": document_id, "name": "Tema3.pdf", "status": "ready", "page_count": 20}
    ]
    assert repository.generation_status("flashcards", str(deck_id)) == (
        "failed",
        "No valid flashcards could be generated.",
    )


def test_student_name_comes_from_the_users_row(conn, database):
    user_id, *_ = _setup(conn)
    repository = PostgresConversationRepository(database)

    assert repository.student_name(user_id) is None
    conn.execute("update users set name = '  ' where id = %s", (user_id,))
    assert repository.student_name(user_id) is None
    conn.execute("update users set name = ' Ana ' where id = %s", (user_id,))
    assert repository.student_name(user_id) == "Ana"
    assert repository.student_name("00000000-0000-0000-0000-000000000000") is None
