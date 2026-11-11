"""Owner-scoped reads and writes for the REST API.

Every query is filtered by the caller's user id; a row that belongs to someone
else behaves exactly like a missing row (None / False), so the API answers 404
and never reveals that it exists.
"""

import psycopg
from psycopg import sql
from psycopg.rows import dict_row

OWNED_DOCUMENT = "documents d join projects p on p.id = d.project_id"
DOCUMENT_COLUMNS = (
    "d.id, d.project_id, d.name, d.s3_key, d.size_bytes, d.page_count, d.status, d.error_message, "
    "d.created_at, d.updated_at"
)


class StillGenerating(Exception):
    """A deck or quiz cannot change while its generation job may still read or write it."""


class PostgresCatalog:
    def __init__(self, conninfo: str):
        self.conninfo = conninfo

    def _connect(self):
        return psycopg.connect(self.conninfo, row_factory=dict_row)

    # --- users -------------------------------------------------------------------

    def ensure_user(self, user_id: str, email: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "insert into users (id, email) values (%s, %s) on conflict (id) do nothing", (user_id, email)
            )

    def get_user(self, user_id: str) -> dict:
        with self._connect() as conn:
            return conn.execute("select id, email, name from users where id = %s", (user_id,)).fetchone()

    def update_user_name(self, user_id: str, name: str) -> dict:
        with self._connect() as conn:
            return conn.execute(
                "update users set name = %s where id = %s returning id, email, name", (name, user_id)
            ).fetchone()

    # --- projects ------------------------------------------------------------------

    def list_projects(self, user_id: str) -> list[dict]:
        with self._connect() as conn:
            return conn.execute(
                "select id, name, description, created_at, updated_at from projects "
                "where user_id = %s order by created_at",
                (user_id,),
            ).fetchall()

    def create_project(self, user_id: str, name: str, description: str | None) -> dict:
        with self._connect() as conn:
            return conn.execute(
                "insert into projects (user_id, name, description) values (%s, %s, %s) "
                "returning id, name, description, created_at, updated_at",
                (user_id, name, description),
            ).fetchone()

    def update_project(self, user_id: str, project_id: str, changes: dict) -> dict | None:
        """Set exactly the fields present in `changes`; an explicit None clears a nullable field."""
        assignments = [
            sql.SQL("{} = {}").format(sql.Identifier(column), sql.Placeholder(column))
            for column in ("name", "description")
            if column in changes
        ]
        if not assignments:
            assignments = [sql.SQL("name = name")]  # nothing to change: still answer with the owned row
        query = sql.SQL(
            "update projects set {} where id = %(id)s and user_id = %(user_id)s "
            "returning id, name, description, created_at, updated_at"
        ).format(sql.SQL(", ").join(assignments))
        with self._connect() as conn:
            return conn.execute(query, {**changes, "id": project_id, "user_id": user_id}).fetchone()

    def delete_project(self, user_id: str, project_id: str) -> list[dict] | None:
        """Delete the project; return its documents' (id, s3_key) so their files can be removed."""
        with self._connect() as conn, conn.transaction():
            if not self._owns_project(conn, user_id, project_id):
                return None
            documents = conn.execute(
                "select id, s3_key from documents where project_id = %s", (project_id,)
            ).fetchall()
            conn.execute("delete from projects where id = %s", (project_id,))
        return documents

    # --- documents -----------------------------------------------------------------

    def count_documents(self, user_id: str, project_id: str) -> int | None:
        with self._connect() as conn:
            if not self._owns_project(conn, user_id, project_id):
                return None
            return conn.execute(
                "select count(*) as n from documents where project_id = %s", (project_id,)
            ).fetchone()["n"]

    def list_documents(self, user_id: str, project_id: str) -> list[dict] | None:
        with self._connect() as conn:
            if not self._owns_project(conn, user_id, project_id):
                return None
            return conn.execute(
                f"select {DOCUMENT_COLUMNS} from {OWNED_DOCUMENT} where d.project_id = %s order by d.created_at",
                (project_id,),
            ).fetchall()

    def create_document(self, document_id: str, project_id: str, name: str, s3_key: str, size_bytes: int) -> dict:
        with self._connect() as conn:
            conn.execute(
                "insert into documents (id, project_id, name, s3_key, size_bytes) values (%s, %s, %s, %s, %s)",
                (document_id, project_id, name, s3_key, size_bytes),
            )
            return conn.execute(
                f"select {DOCUMENT_COLUMNS} from {OWNED_DOCUMENT} where d.id = %s", (document_id,)
            ).fetchone()

    def get_document(self, user_id: str, document_id: str) -> dict | None:
        with self._connect() as conn:
            return conn.execute(
                f"select {DOCUMENT_COLUMNS} from {OWNED_DOCUMENT} where d.id = %s and p.user_id = %s",
                (document_id, user_id),
            ).fetchone()

    def rename_document(self, user_id: str, document_id: str, name: str) -> dict | None:
        with self._connect() as conn:
            updated = conn.execute(
                "update documents d set name = %s from projects p "
                "where p.id = d.project_id and d.id = %s and p.user_id = %s returning d.id",
                (name, document_id, user_id),
            ).fetchone()
        return self.get_document(user_id, document_id) if updated else None

    def delete_document(self, user_id: str, document_id: str) -> str | None:
        """Delete the row and return its s3_key, or None if the caller does not own it."""
        with self._connect() as conn:
            row = conn.execute(
                "delete from documents d using projects p "
                "where p.id = d.project_id and d.id = %s and p.user_id = %s returning d.s3_key",
                (document_id, user_id),
            ).fetchone()
        return row["s3_key"] if row else None

    # --- study artifacts -------------------------------------------------------------

    def list_summaries(self, user_id: str, document_id: str) -> list[dict]:
        return self._list_artifacts("summaries s", "s.id, s.document_id, s.status, s.content, s.error_message, s.created_at",
                                    user_id, document_id)

    def get_summary(self, user_id: str, summary_id: str) -> dict | None:
        return self._get_artifact("summaries s", "s.id, s.document_id, s.status, s.content, s.error_message, s.created_at",
                                  user_id, summary_id)

    def list_decks(self, user_id: str, document_id: str) -> list[dict]:
        return self._list_artifacts("flashcard_decks s", SET_COLUMNS, user_id, document_id)

    def get_deck(self, user_id: str, deck_id: str) -> dict | None:
        deck = self._get_artifact("flashcard_decks s", SET_COLUMNS, user_id, deck_id)
        if deck:
            with self._connect() as conn:
                deck["cards"] = conn.execute(
                    "select question, answer, page_number as page from flashcards where deck_id = %s order by position",
                    (deck_id,),
                ).fetchall()
        return deck

    def list_quizzes(self, user_id: str, document_id: str) -> list[dict]:
        return self._list_artifacts("quizzes s", SET_COLUMNS, user_id, document_id)

    def get_quiz(self, user_id: str, quiz_id: str) -> dict | None:
        """The quiz with its questions, without the correct answers."""
        quiz = self._get_artifact("quizzes s", SET_COLUMNS, user_id, quiz_id)
        if quiz:
            with self._connect() as conn:
                quiz["questions"] = conn.execute(
                    "select id, question, options, page_number as page from quiz_questions "
                    "where quiz_id = %s order by position",
                    (quiz_id,),
                ).fetchall()
        return quiz

    def _list_artifacts(self, table: str, columns: str, user_id: str, document_id: str) -> list[dict]:
        with self._connect() as conn:
            return conn.execute(
                f"select {columns} from {table} join {OWNED_DOCUMENT} on d.id = s.document_id "
                "where s.document_id = %s and p.user_id = %s order by s.created_at desc",
                (document_id, user_id),
            ).fetchall()

    def _get_artifact(self, table: str, columns: str, user_id: str, artifact_id: str) -> dict | None:
        with self._connect() as conn:
            return conn.execute(
                f"select {columns} from {table} join {OWNED_DOCUMENT} on d.id = s.document_id "
                "where s.id = %s and p.user_id = %s",
                (artifact_id, user_id),
            ).fetchone()

    def rename_deck(self, user_id: str, deck_id: str, topic: str | None) -> dict | None:
        renamed = self._edit_set("flashcard_decks", user_id, deck_id, ("update flashcard_decks s set topic = %s from", topic))
        return self.get_deck(user_id, deck_id) if renamed else None

    def rename_quiz(self, user_id: str, quiz_id: str, topic: str | None) -> dict | None:
        renamed = self._edit_set("quizzes", user_id, quiz_id, ("update quizzes s set topic = %s from", topic))
        return self.get_quiz(user_id, quiz_id) if renamed else None

    def delete_deck(self, user_id: str, deck_id: str) -> bool:
        """Its cards go with it; the chat message that created it keeps its text (on delete set null)."""
        return self._edit_set("flashcard_decks", user_id, deck_id, ("delete from flashcard_decks s using", None))

    def delete_quiz(self, user_id: str, quiz_id: str) -> bool:
        """Its questions and attempts go with it; the chat message keeps its text (on delete set null)."""
        return self._edit_set("quizzes", user_id, quiz_id, ("delete from quizzes s using", None))

    def _edit_set(self, table: str, user_id: str, set_id: str, edit: tuple[str, str | None]) -> bool:
        """Apply `edit` (the statement up to its join, and the new topic for an update) to one owned deck
        or quiz. False if the caller does not own it. Raises StillGenerating while it is pending, because
        its job reads the topic and writes its cards or questions when it runs."""
        statement, topic = edit
        params = ([topic] if statement.startswith("update") else []) + [set_id, user_id]
        with self._connect() as conn:
            row = conn.execute(
                f"{statement} {OWNED_DOCUMENT} where d.id = s.document_id and s.id = %s and p.user_id = %s "
                "and s.status <> 'pending' returning s.id",
                params,
            ).fetchone()
            if row:
                return True
            pending = conn.execute(
                f"select 1 from {table} s join {OWNED_DOCUMENT} on d.id = s.document_id "
                "where s.id = %s and p.user_id = %s and s.status = 'pending'",
                (set_id, user_id),
            ).fetchone()
        if pending:
            raise StillGenerating("It is still being generated.")
        return False

    # --- conversations ---------------------------------------------------------------

    def list_conversations(self, user_id: str, project_id: str) -> list[dict] | None:
        with self._connect() as conn:
            if not self._owns_project(conn, user_id, project_id):
                return None
            return conn.execute(
                "select id, project_id, title, created_at, updated_at from conversations "
                "where project_id = %s order by updated_at desc",
                (project_id,),
            ).fetchall()

    def create_conversation(self, user_id: str, project_id: str, title: str | None) -> dict | None:
        with self._connect() as conn:
            if not self._owns_project(conn, user_id, project_id):
                return None
            return conn.execute(
                "insert into conversations (project_id, title) values (%s, %s) "
                "returning id, project_id, title, created_at, updated_at",
                (project_id, title),
            ).fetchone()

    def list_messages(self, user_id: str, conversation_id: str) -> list[dict] | None:
        with self._connect() as conn:
            if not self._owns_conversation(conn, user_id, conversation_id):
                return None
            messages = conn.execute(
                "select id, role, content, summary_id, flashcard_deck_id, quiz_id, created_at from chat_messages "
                "where conversation_id = %s order by created_at, role",  # enum order: user before assistant
                (conversation_id,),
            ).fetchall()
            sources = conn.execute(
                "select s.message_id, s.rank as n, d.id as document_id, d.name as document_name, c.page_number as page "
                "from message_sources s join chat_messages m on m.id = s.message_id "
                "join document_chunks c on c.id = s.chunk_id join documents d on d.id = c.document_id "
                "where m.conversation_id = %s order by s.rank",
                (conversation_id,),
            ).fetchall()
        by_message: dict = {}
        for source in sources:
            by_message.setdefault(source.pop("message_id"), []).append(source)
        for message in messages:
            message["sources"] = by_message.get(message["id"], [])
        return messages

    def delete_conversation(self, user_id: str, conversation_id: str) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                "delete from conversations c using projects p "
                "where p.id = c.project_id and c.id = %s and p.user_id = %s returning c.id",
                (conversation_id, user_id),
            ).fetchone()
        return row is not None

    # --- ownership -----------------------------------------------------------------

    @staticmethod
    def _owns_project(conn, user_id: str, project_id: str) -> bool:
        return conn.execute(
            "select 1 from projects where id = %s and user_id = %s", (project_id, user_id)
        ).fetchone() is not None

    @staticmethod
    def _owns_conversation(conn, user_id: str, conversation_id: str) -> bool:
        return conn.execute(
            "select 1 from conversations c join projects p on p.id = c.project_id where c.id = %s and p.user_id = %s",
            (conversation_id, user_id),
        ).fetchone() is not None


SET_COLUMNS = "s.id, s.document_id, s.topic, s.requested_count, s.status, s.error_message, s.created_at"
