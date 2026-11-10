import psycopg

from adapters.postgres.study import TABLES
from services.agent_tools import Source
from services.chat import HistoryMessage

ARTIFACT_COLUMNS = {"summary": "summary_id", "flashcards": "flashcard_deck_id", "quiz": "quiz_id"}
TITLE_CHARS = 60


class PostgresConversationRepository:
    def __init__(self, conninfo: str):
        self.conninfo = conninfo

    def project_of(self, user_id: str, conversation_id: str) -> str | None:
        with psycopg.connect(self.conninfo) as conn:
            row = conn.execute(
                "select c.project_id from conversations c join projects p on p.id = c.project_id "
                "where c.id = %s and p.user_id = %s",
                (conversation_id, user_id),
            ).fetchone()
        return str(row[0]) if row else None

    def recent_messages(self, conversation_id: str, max_chars: int) -> list[HistoryMessage]:
        with psycopg.connect(self.conninfo) as conn:
            # Newest first. message_role is an enum ordered as declared (user, assistant),
            # so on a timestamp tie "role desc" puts a turn's answer before its question.
            rows = conn.execute(
                "select role, content from chat_messages where conversation_id = %s order by created_at desc, role desc",
                (conversation_id,),
            ).fetchall()
        kept, used = [], 0
        for role, content in rows:
            if used + len(content) > max_chars:
                break
            kept.append(HistoryMessage(role, content))
            used += len(content)
        kept.reverse()
        while kept and kept[0].role != "user":  # the model expects the history to open with the user
            kept.pop(0)
        return kept

    def save_turn(
        self, conversation_id: str, question: str, answer: str, sources: list[Source], artifacts: dict[str, str]
    ) -> str:
        columns = [ARTIFACT_COLUMNS[kind] for kind in artifacts]
        with psycopg.connect(self.conninfo) as conn, conn.transaction():
            conn.execute(
                "insert into chat_messages (conversation_id, role, content) values (%s, 'user', %s)",
                (conversation_id, question),
            )
            # clock_timestamp(), unlike now(), moves inside the transaction: the answer sorts after its question.
            message_id = conn.execute(
                f"insert into chat_messages (conversation_id, role, content, created_at{''.join(', ' + c for c in columns)}) "
                f"values (%s, 'assistant', %s, clock_timestamp(){', %s' * len(columns)}) returning id",
                (conversation_id, answer, *artifacts.values()),
            ).fetchone()[0]
            with conn.cursor() as cursor:
                cursor.executemany(
                    "insert into message_sources (message_id, chunk_id, rank) values (%s, %s, %s)",
                    [(message_id, s.chunk_id, s.n) for s in sources],
                )
            conn.execute(
                "update conversations set title = %s where id = %s and title is null",
                (_title(question), conversation_id),
            )
        return str(message_id)

    def list_documents_of_project(self, project_id: str) -> list[dict]:
        with psycopg.connect(self.conninfo) as conn:
            rows = conn.execute(
                "select id, name, status, page_count from documents where project_id = %s order by created_at",
                (project_id,),
            ).fetchall()
        return [{"id": str(i), "name": name, "status": status, "page_count": pages} for i, name, status, pages in rows]

    def generation_status(self, kind: str, generation_id: str) -> tuple[str, str | None]:
        with psycopg.connect(self.conninfo) as conn:
            status, message = conn.execute(
                f"select status, error_message from {TABLES[kind]} where id = %s", (generation_id,)
            ).fetchone()
        return status, message


def _title(question: str) -> str:
    question = " ".join(question.split())
    if len(question) <= TITLE_CHARS:
        return question
    return question[:TITLE_CHARS].rsplit(" ", 1)[0] + "…"
