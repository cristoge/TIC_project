import psycopg
from psycopg.types.json import Jsonb

from domain.study import Flashcard, GradedAnswer, QuizQuestion
from services.study import DocumentInfo, GenerationRequest, StoredQuestion

TABLES = {"summary": "summaries", "flashcards": "flashcard_decks", "quiz": "quizzes"}


class PostgresStudyRepository:
    def __init__(self, conninfo: str):
        self.conninfo = conninfo

    def get_document(self, document_id: str) -> DocumentInfo:
        with psycopg.connect(self.conninfo) as conn:
            project_id, page_count, status = conn.execute(
                "select project_id, coalesce(page_count, 0), status from documents where id = %s", (document_id,)
            ).fetchone()
        return DocumentInfo(project_id=str(project_id), page_count=page_count, status=status)

    def create_generation(
        self, kind: str, document_id: str, model: str, topic: str | None = None, requested_count: int | None = None
    ) -> str:
        with psycopg.connect(self.conninfo) as conn:
            if kind == "summary":
                row = conn.execute(
                    "insert into summaries (document_id, model) values (%s, %s) returning id", (document_id, model)
                ).fetchone()
            else:
                row = conn.execute(
                    f"insert into {TABLES[kind]} (document_id, topic, requested_count, model) "
                    "values (%s, %s, %s, %s) returning id",
                    (document_id, topic, requested_count, model),
                ).fetchone()
        return str(row[0])

    def get_request(self, kind: str, generation_id: str) -> GenerationRequest:
        columns = "document_id, null, null" if kind == "summary" else "document_id, topic, requested_count"
        with psycopg.connect(self.conninfo) as conn:
            document_id, topic, requested_count = conn.execute(
                f"select {columns} from {TABLES[kind]} where id = %s", (generation_id,)
            ).fetchone()
        return GenerationRequest(document_id=str(document_id), topic=topic, requested_count=requested_count)

    def complete_summary(self, summary_id: str, content: dict) -> None:
        with psycopg.connect(self.conninfo) as conn:
            conn.execute(
                "update summaries set status = 'ready', content = %s, error_message = null where id = %s",
                (Jsonb(content), summary_id),
            )

    def complete_deck(self, deck_id: str, cards: list[Flashcard]) -> None:
        with psycopg.connect(self.conninfo) as conn, conn.transaction():
            conn.execute("delete from flashcards where deck_id = %s", (deck_id,))
            with conn.cursor() as cursor:
                cursor.executemany(
                    "insert into flashcards (deck_id, position, question, answer, page_number) values (%s, %s, %s, %s, %s)",
                    [(deck_id, position, c.question, c.answer, c.page) for position, c in enumerate(cards)],
                )
            conn.execute(
                "update flashcard_decks set status = 'ready', error_message = null where id = %s", (deck_id,)
            )

    def complete_quiz(self, quiz_id: str, questions: list[QuizQuestion]) -> None:
        with psycopg.connect(self.conninfo) as conn, conn.transaction():
            conn.execute("delete from quiz_questions where quiz_id = %s", (quiz_id,))
            with conn.cursor() as cursor:
                cursor.executemany(
                    "insert into quiz_questions "
                    "(quiz_id, position, question, options, correct_index, explanation, page_number) "
                    "values (%s, %s, %s, %s, %s, %s, %s)",
                    [
                        (quiz_id, position, q.question, q.options, q.correct_index, q.explanation, q.page)
                        for position, q in enumerate(questions)
                    ],
                )
            conn.execute("update quizzes set status = 'ready', error_message = null where id = %s", (quiz_id,))

    def fail_generation(self, kind: str, generation_id: str, message: str) -> None:
        with psycopg.connect(self.conninfo) as conn:
            conn.execute(
                f"update {TABLES[kind]} set status = 'failed', error_message = %s where id = %s",
                (message, generation_id),
            )

    def previous_questions(self, document_id: str) -> list[str]:
        with psycopg.connect(self.conninfo) as conn:
            rows = conn.execute(
                "select f.question from flashcards f join flashcard_decks d on d.id = f.deck_id "
                "where d.document_id = %s order by d.created_at, f.position",
                (document_id,),
            ).fetchall()
        return [row[0] for row in rows]

    def quiz_questions(self, quiz_id: str) -> list[StoredQuestion]:
        with psycopg.connect(self.conninfo) as conn:
            rows = conn.execute(
                "select q.id, q.correct_index, q.explanation from quiz_questions q "
                "join quizzes z on z.id = q.quiz_id where z.id = %s and z.status = 'ready' order by q.position",
                (quiz_id,),
            ).fetchall()
        return [StoredQuestion(id=str(id_), correct_index=correct, explanation=explanation) for id_, correct, explanation in rows]

    def save_attempt(self, quiz_id: str, score: int, total: int, answers: list[GradedAnswer]) -> str:
        with psycopg.connect(self.conninfo) as conn, conn.transaction():
            attempt_id = conn.execute(
                "insert into quiz_attempts (quiz_id, score, total) values (%s, %s, %s) returning id",
                (quiz_id, score, total),
            ).fetchone()[0]
            with conn.cursor() as cursor:
                cursor.executemany(
                    "insert into quiz_answers (attempt_id, question_id, selected_index, is_correct) values (%s, %s, %s, %s)",
                    [(attempt_id, a.question_id, a.selected_index, a.is_correct) for a in answers],
                )
        return str(attempt_id)
