import random

import pytest
from fastapi.testclient import TestClient

from adapters.postgres.catalog import PostgresCatalog
from adapters.postgres.study import PostgresStudyRepository
from entrypoints.api.app import Container, create_app
from entrypoints.api.auth import CurrentUser, get_current_user
from services.study import StudyService

ALICE = CurrentUser(id="00000000-0000-0000-0000-00000000000a", email="alice@example.com")
BOB = CurrentUser(id="00000000-0000-0000-0000-00000000000b", email="bob@example.com")


class FakeStorage:
    def __init__(self):
        self.deleted = []

    def create_upload(self, s3_key, max_bytes):
        return {"url": "https://docs.s3.amazonaws.com", "fields": {"key": s3_key, "max": str(max_bytes)}}

    def delete_document_objects(self, document_id, s3_key):
        self.deleted.append((document_id, s3_key))


class FakeQueue:
    def __init__(self):
        self.jobs = []

    def enqueue(self, kind, generation_id):
        self.jobs.append((kind, generation_id))


class Unused:
    def __getattr__(self, name):
        raise AssertionError(f"not expected in API tests: {name}")


@pytest.fixture
def api(database):
    storage, queue = FakeStorage(), FakeQueue()
    study = StudyService(
        repository=PostgresStudyRepository(database),
        pages=Unused(),
        search=Unused(),
        llm=Unused(),
        model_id="nova",
        rng=random.Random(1),
    )
    container = Container(catalog=PostgresCatalog(database), study=study, storage=storage, queue=queue)
    app = create_app(container)
    current = {"user": ALICE}
    app.dependency_overrides[get_current_user] = lambda: current["user"]

    class Api:
        client = TestClient(app)

        def as_user(self, user):
            current["user"] = user
            return self

    api = Api()
    api.storage, api.queue, api.conninfo = storage, queue, database
    return api


def _project(api, name="Biology"):
    response = api.client.post("/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()["id"]


def _document(api, project_id, name="Tema3.pdf"):
    response = api.client.post(f"/projects/{project_id}/documents", json={"name": name, "size_bytes": 1000})
    assert response.status_code == 201
    return response.json()


def _mark_ready(conn, document_id, page_count=3):
    conn.execute("update documents set status = 'ready', page_count = %s where id = %s", (page_count, document_id))


# --- me --------------------------------------------------------------------------


def test_first_request_creates_the_user_and_name_can_be_changed(api):
    assert api.client.get("/me").json() == {"id": ALICE.id, "email": ALICE.email, "name": None}

    response = api.client.patch("/me", json={"name": "Alice"})

    assert response.json()["name"] == "Alice"
    assert api.client.get("/me").json()["name"] == "Alice"


# --- projects ----------------------------------------------------------------------


def test_project_crud(api):
    project_id = _project(api)

    assert [p["name"] for p in api.client.get("/projects").json()] == ["Biology"]
    assert api.client.patch(f"/projects/{project_id}", json={"name": "Bio II"}).json()["name"] == "Bio II"
    assert api.client.delete(f"/projects/{project_id}").status_code == 204
    assert api.client.get("/projects").json() == []


def test_users_cannot_see_or_change_each_others_projects(api):
    project_id = _project(api)
    api.as_user(BOB)

    assert api.client.get("/projects").json() == []
    assert api.client.patch(f"/projects/{project_id}", json={"name": "Mine"}).status_code == 404
    assert api.client.delete(f"/projects/{project_id}").status_code == 404
    assert api.client.get(f"/projects/{project_id}/documents").status_code == 404


def test_deleting_a_project_removes_its_files(api):
    project_id = _project(api)
    document = _document(api, project_id)

    api.client.delete(f"/projects/{project_id}")

    assert api.storage.deleted == [(document["document"]["id"], document["document"]["s3_key"])]


# --- documents -----------------------------------------------------------------------


def test_creating_a_document_returns_a_pending_row_and_an_upload_form(api):
    project_id = _project(api)

    created = _document(api, project_id)

    document = created["document"]
    assert document["status"] == "pending"
    assert document["s3_key"] == f"users/{ALICE.id}/projects/{project_id}/{document['id']}.pdf"
    assert created["upload"]["fields"]["key"] == document["s3_key"]
    assert [d["id"] for d in api.client.get(f"/projects/{project_id}/documents").json()] == [document["id"]]
    assert api.client.get(f"/documents/{document['id']}").json()["name"] == "Tema3.pdf"


def test_only_pdfs_within_the_size_limit_are_accepted(api):
    project_id = _project(api)

    assert api.client.post(f"/projects/{project_id}/documents", json={"name": "notes.docx", "size_bytes": 10}).status_code == 422
    assert (
        api.client.post(f"/projects/{project_id}/documents", json={"name": "big.pdf", "size_bytes": 31 * 1024 * 1024}).status_code
        == 422
    )


def test_a_project_holds_at_most_twenty_documents(api):
    project_id = _project(api)
    for n in range(20):
        _document(api, project_id, name=f"doc{n}.pdf")

    response = api.client.post(f"/projects/{project_id}/documents", json={"name": "doc20.pdf", "size_bytes": 10})

    assert response.status_code == 409


def test_rename_and_delete_a_document(api):
    project_id = _project(api)
    document = _document(api, project_id)["document"]

    assert api.client.patch(f"/documents/{document['id']}", json={"name": "Mitosis.pdf"}).json()["name"] == "Mitosis.pdf"
    assert api.client.delete(f"/documents/{document['id']}").status_code == 204
    assert api.storage.deleted == [(document["id"], document["s3_key"])]
    assert api.client.get(f"/documents/{document['id']}").status_code == 404


def test_other_users_documents_are_not_found(api):
    project_id = _project(api)
    document_id = _document(api, project_id)["document"]["id"]
    api.as_user(BOB)

    for method, path in (("get", ""), ("patch", ""), ("delete", ""), ("post", "/summaries")):
        kwargs = {"json": {"name": "x"}} if method == "patch" else {}
        assert getattr(api.client, method)(f"/documents/{document_id}{path}", **kwargs).status_code == 404


# --- study artifacts -------------------------------------------------------------------


def test_summary_request_needs_a_ready_document_and_queues_a_job(api, conn):
    project_id = _project(api)
    document_id = _document(api, project_id)["document"]["id"]

    assert api.client.post(f"/documents/{document_id}/summaries").status_code == 409

    _mark_ready(conn, document_id)
    response = api.client.post(f"/documents/{document_id}/summaries")

    assert response.status_code == 202
    summary = response.json()
    assert summary["status"] == "pending"
    assert api.queue.jobs == [("summary", summary["id"])]
    assert [s["id"] for s in api.client.get(f"/documents/{document_id}/summaries").json()] == [summary["id"]]
    assert api.client.get(f"/summaries/{summary['id']}").json()["content"] is None


def test_flashcard_requests_are_validated_and_queued(api, conn):
    project_id = _project(api)
    document_id = _document(api, project_id)["document"]["id"]
    _mark_ready(conn, document_id)

    assert api.client.post(f"/documents/{document_id}/flashcard-decks", json={"count": 0}).status_code == 422
    response = api.client.post(f"/documents/{document_id}/flashcard-decks", json={"count": 5, "topic": "mitosis"})

    assert response.status_code == 202
    deck = response.json()
    assert (deck["status"], deck["topic"], deck["requested_count"]) == ("pending", "mitosis", 5)
    assert api.queue.jobs == [("flashcards", deck["id"])]
    assert api.client.get(f"/flashcard-decks/{deck['id']}").json()["cards"] == []


def test_ready_deck_returns_its_cards(api, conn):
    project_id = _project(api)
    document_id = _document(api, project_id)["document"]["id"]
    _mark_ready(conn, document_id)
    deck_id = api.client.post(f"/documents/{document_id}/flashcard-decks", json={"count": 1}).json()["id"]
    conn.execute(
        "insert into flashcards (deck_id, position, question, answer, page_number) values (%s, 0, 'Q?', 'A.', 2)",
        (deck_id,),
    )
    conn.execute("update flashcard_decks set status = 'ready' where id = %s", (deck_id,))

    deck = api.client.get(f"/flashcard-decks/{deck_id}").json()

    assert deck["status"] == "ready"
    assert [(c["question"], c["answer"], c["page"]) for c in deck["cards"]] == [("Q?", "A.", 2)]


def _ready_quiz(api, conn):
    project_id = _project(api)
    document_id = _document(api, project_id)["document"]["id"]
    _mark_ready(conn, document_id)
    quiz_id = api.client.post(f"/documents/{document_id}/quizzes", json={"count": 2}).json()["id"]
    for position, correct in ((0, 1), (1, 3)):
        conn.execute(
            "insert into quiz_questions (quiz_id, position, question, options, correct_index, explanation, page_number) "
            "values (%s, %s, %s, %s, %s, 'Because.', 1)",
            (quiz_id, position, f"Q{position}?", ["a", "b", "c", "d"], correct),
        )
    conn.execute("update quizzes set status = 'ready' where id = %s", (quiz_id,))
    return quiz_id


def test_quiz_questions_do_not_reveal_the_answers(api, conn):
    quiz_id = _ready_quiz(api, conn)

    quiz = api.client.get(f"/quizzes/{quiz_id}").json()

    assert [q["question"] for q in quiz["questions"]] == ["Q0?", "Q1?"]
    assert all(set(q) == {"id", "question", "options", "page"} for q in quiz["questions"])


def test_quiz_attempt_is_graded_on_the_server(api, conn):
    quiz_id = _ready_quiz(api, conn)
    questions = api.client.get(f"/quizzes/{quiz_id}").json()["questions"]

    response = api.client.post(
        f"/quizzes/{quiz_id}/attempts", json={"answers": {questions[0]["id"]: 1, questions[1]["id"]: 0}}
    )

    assert response.status_code == 201
    result = response.json()
    assert (result["score"], result["total"]) == (1, 2)
    assert [(a["is_correct"], a["correct_index"]) for a in result["answers"]] == [(True, 1), (False, 3)]


def test_incomplete_quiz_attempt_is_rejected(api, conn):
    quiz_id = _ready_quiz(api, conn)
    questions = api.client.get(f"/quizzes/{quiz_id}").json()["questions"]

    response = api.client.post(f"/quizzes/{quiz_id}/attempts", json={"answers": {questions[0]["id"]: 1}})

    assert response.status_code == 422


def test_other_users_quizzes_are_not_found(api, conn):
    quiz_id = _ready_quiz(api, conn)
    api.as_user(BOB)

    assert api.client.get(f"/quizzes/{quiz_id}").status_code == 404
    assert api.client.post(f"/quizzes/{quiz_id}/attempts", json={"answers": {}}).status_code == 404


# --- conversations -------------------------------------------------------------------


def test_conversations_list_messages_with_their_sources(api, conn):
    project_id = _project(api)
    document_id = _document(api, project_id)["document"]["id"]
    _mark_ready(conn, document_id)
    conversation = api.client.post(f"/projects/{project_id}/conversations", json={"title": "Mitosis"}).json()
    chunk_id = conn.execute(
        "insert into document_chunks (document_id, chunk_index, page_number, content, embedding, embedding_model) "
        "values (%s, 0, 12, 'Mitosis...', array_fill(0, array[512])::vector, 'm') returning id",
        (document_id,),
    ).fetchone()[0]
    conn.execute("insert into chat_messages (conversation_id, role, content) values (%s, 'user', 'What is mitosis?')", (conversation["id"],))
    answer_id = conn.execute(
        "insert into chat_messages (conversation_id, role, content) values (%s, 'assistant', 'A division [1].') returning id",
        (conversation["id"],),
    ).fetchone()[0]
    conn.execute("insert into message_sources (message_id, chunk_id, rank) values (%s, %s, 1)", (answer_id, chunk_id))

    assert [c["title"] for c in api.client.get(f"/projects/{project_id}/conversations").json()] == ["Mitosis"]
    messages = api.client.get(f"/conversations/{conversation['id']}/messages").json()

    assert [(m["role"], m["content"]) for m in messages] == [("user", "What is mitosis?"), ("assistant", "A division [1].")]
    assert messages[1]["sources"] == [{"n": 1, "document_id": document_id, "document_name": "Tema3.pdf", "page": 12}]


def test_a_question_and_answer_with_the_same_timestamp_are_listed_question_first(api, conn):
    project_id = _project(api)
    conversation_id = api.client.post(f"/projects/{project_id}/conversations", json={}).json()["id"]
    with conn.transaction():  # now() is the same for both rows
        conn.execute("insert into chat_messages (conversation_id, role, content) values (%s, 'user', 'Q')", (conversation_id,))
        conn.execute(
            "insert into chat_messages (conversation_id, role, content) values (%s, 'assistant', 'A')", (conversation_id,)
        )

    messages = api.client.get(f"/conversations/{conversation_id}/messages").json()

    assert [m["role"] for m in messages] == ["user", "assistant"]


def test_other_users_conversations_are_not_found(api):
    project_id = _project(api)
    conversation_id = api.client.post(f"/projects/{project_id}/conversations", json={}).json()["id"]
    api.as_user(BOB)

    assert api.client.get(f"/conversations/{conversation_id}/messages").status_code == 404
    assert api.client.delete(f"/conversations/{conversation_id}").status_code == 404
    assert api.client.post(f"/projects/{project_id}/conversations", json={}).status_code == 404
