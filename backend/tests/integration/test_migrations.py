import psycopg

from adapters.postgres.migrations import apply_migrations

EXPECTED_TABLES = {
    "schema_migrations",
    "users",
    "projects",
    "documents",
    "document_chunks",
    "summaries",
    "flashcard_decks",
    "flashcards",
    "quizzes",
    "quiz_questions",
    "quiz_attempts",
    "quiz_answers",
    "conversations",
    "chat_messages",
    "message_sources",
}


def _tables(conninfo):
    with psycopg.connect(conninfo) as conn:
        rows = conn.execute(
            "select table_name from information_schema.tables where table_schema = 'public'"
        ).fetchall()
    return {row[0] for row in rows}


def test_apply_migrations_creates_the_full_schema(empty_database):
    applied = apply_migrations(empty_database)

    assert applied == ["0001_initial_schema.sql"]
    assert _tables(empty_database) == EXPECTED_TABLES


def test_apply_migrations_twice_applies_nothing_the_second_time(empty_database):
    apply_migrations(empty_database)

    assert apply_migrations(empty_database) == []
    assert _tables(empty_database) == EXPECTED_TABLES


def test_new_chat_message_moves_its_conversation_to_the_top(conn):
    user_id = conn.execute(
        "insert into users (id, email) values (gen_random_uuid(), 'a@example.com') returning id"
    ).fetchone()[0]
    project_id = conn.execute(
        "insert into projects (user_id, name) values (%s, 'Biology') returning id", (user_id,)
    ).fetchone()[0]
    conversation_id, created_at = conn.execute(
        "insert into conversations (project_id, created_at, updated_at) "
        "values (%s, now() - interval '1 day', now() - interval '1 day') returning id, updated_at",
        (project_id,),
    ).fetchone()

    conn.execute(
        "insert into chat_messages (conversation_id, role, content) values (%s, 'user', 'Hi')",
        (conversation_id,),
    )

    updated_at = conn.execute(
        "select updated_at from conversations where id = %s", (conversation_id,)
    ).fetchone()[0]
    assert updated_at > created_at


def test_updating_a_project_refreshes_updated_at(conn):
    user_id = conn.execute(
        "insert into users (id, email) values (gen_random_uuid(), 'b@example.com') returning id"
    ).fetchone()[0]
    project_id, before = conn.execute(
        "insert into projects (user_id, name, updated_at) "
        "values (%s, 'Old', now() - interval '1 day') returning id, updated_at",
        (user_id,),
    ).fetchone()

    conn.execute("update projects set name = 'New' where id = %s", (project_id,))

    after = conn.execute("select updated_at from projects where id = %s", (project_id,)).fetchone()[0]
    assert after > before
