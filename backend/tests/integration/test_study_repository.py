from adapters.postgres.study import PostgresStudyRepository
from domain.study import Flashcard, GradedAnswer, QuizQuestion


def _ready_document(conn, page_count=3):
    user_id = conn.execute(
        "insert into users (id, email) values (gen_random_uuid(), 'a@example.com') returning id"
    ).fetchone()[0]
    project_id = conn.execute(
        "insert into projects (user_id, name) values (%s, 'Biology') returning id", (user_id,)
    ).fetchone()[0]
    document_id = conn.execute(
        "insert into documents (project_id, name, s3_key, status, page_count) "
        "values (%s, 'Tema3.pdf', 'k', 'ready', %s) returning id",
        (project_id, page_count),
    ).fetchone()[0]
    return str(project_id), str(document_id)


def test_get_document_returns_project_page_count_and_status(conn, database):
    project_id, document_id = _ready_document(conn)

    info = PostgresStudyRepository(database).get_document(document_id)

    assert (info.project_id, info.page_count, info.status) == (project_id, 3, "ready")


def test_summary_lifecycle(conn, database):
    _, document_id = _ready_document(conn)
    repository = PostgresStudyRepository(database)

    summary_id = repository.create_generation("summary", document_id, "nova")
    assert repository.get_request("summary", summary_id).document_id == document_id
    repository.complete_summary(summary_id, {"overview": "Cell division.", "sections": [], "key_terms": []})

    row = conn.execute("select status, content, model from summaries where id = %s", (summary_id,)).fetchone()
    assert row == ("ready", {"overview": "Cell division.", "sections": [], "key_terms": []}, "nova")


def test_failed_generation_keeps_the_message(conn, database):
    _, document_id = _ready_document(conn)
    repository = PostgresStudyRepository(database)
    quiz_id = repository.create_generation("quiz", document_id, "nova", topic="mitosis", requested_count=5)

    repository.fail_generation("quiz", quiz_id, "No valid questions.")

    assert conn.execute("select status, error_message from quizzes where id = %s", (quiz_id,)).fetchone() == (
        "failed",
        "No valid questions.",
    )


def test_deck_lifecycle_and_previous_questions_across_decks(conn, database):
    _, document_id = _ready_document(conn)
    repository = PostgresStudyRepository(database)
    first = repository.create_generation("flashcards", document_id, "nova", requested_count=2)
    second = repository.create_generation("flashcards", document_id, "nova", topic="meiosis", requested_count=2)

    request = repository.get_request("flashcards", second)
    assert (request.document_id, request.topic, request.requested_count) == (document_id, "meiosis", 2)

    repository.complete_deck(first, [Flashcard(question="Q1", answer="A1", page=1), Flashcard(question="Q2", answer="A2", page=2)])

    rows = conn.execute(
        "select position, question, answer, page_number from flashcards where deck_id = %s order by position", (first,)
    ).fetchall()
    assert rows == [(0, "Q1", "A1", 1), (1, "Q2", "A2", 2)]
    assert conn.execute("select status from flashcard_decks where id = %s", (first,)).fetchone() == ("ready",)
    assert repository.previous_questions(document_id) == ["Q1", "Q2"]


def test_quiz_questions_and_attempts(conn, database):
    _, document_id = _ready_document(conn)
    repository = PostgresStudyRepository(database)
    quiz_id = repository.create_generation("quiz", document_id, "nova", requested_count=1)
    repository.complete_quiz(
        quiz_id,
        [QuizQuestion(question="Mitosis produces?", options=["Four", "Two", "One", "Eight"], correct_index=1,
                      explanation="Two identical cells.", page=1)],
    )

    (stored,) = repository.quiz_questions(quiz_id)
    assert (stored.correct_index, stored.explanation) == (1, "Two identical cells.")

    attempt_id = repository.save_attempt(
        quiz_id, 1, 1, [GradedAnswer(stored.id, 1, 1, True, "Two identical cells.")]
    )

    assert conn.execute("select score, total from quiz_attempts where id = %s", (attempt_id,)).fetchone() == (1, 1)
    assert conn.execute(
        "select question_id::text, selected_index, is_correct from quiz_answers where attempt_id = %s", (attempt_id,)
    ).fetchall() == [(stored.id, 1, True)]


def test_quiz_questions_of_a_quiz_that_is_not_ready_are_empty(conn, database):
    _, document_id = _ready_document(conn)
    repository = PostgresStudyRepository(database)
    quiz_id = repository.create_generation("quiz", document_id, "nova", requested_count=3)

    assert repository.quiz_questions(quiz_id) == []
