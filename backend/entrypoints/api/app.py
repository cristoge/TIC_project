"""REST API for the app: users, projects, documents, study artifacts and conversation history.

The chat itself runs in the agent server (entrypoints/agent); this API only
reads the stored conversations.
"""

import uuid
from dataclasses import asdict, dataclass
from typing import Protocol

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status

from adapters.postgres.catalog import PostgresCatalog, StillGenerating
from entrypoints.api import schemas
from entrypoints.api.auth import CurrentUser, JwtVerifier, get_current_user
from services.study import DocumentNotReady, StudyService


class Storage(Protocol):
    def create_upload(self, s3_key: str, max_bytes: int) -> dict: ...

    def delete_document_objects(self, document_id: str, s3_key: str) -> None: ...


class JobQueue(Protocol):
    def enqueue(self, kind: str, generation_id: str) -> None: ...


@dataclass
class Container:
    catalog: PostgresCatalog
    study: StudyService
    storage: Storage
    queue: JobQueue


def create_app(container: Container, jwt_verifier: JwtVerifier | None = None, local_uploads=None) -> FastAPI:
    """`jwt_verifier` validates the Cognito ID token; without it every request is rejected (401).

    `local_uploads` adds POST /local-uploads, which receives the file the upload form points to.
    """
    app = FastAPI(title="Study RAG API", version="0.1.0")
    app.state.container = container
    app.state.jwt_verifier = jwt_verifier
    app.state.local_uploads = local_uploads
    if local_uploads is not None:
        _add_local_upload_route(app, local_uploads)

    def user(request: Request, current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        container.catalog.ensure_user(current.id, current.email)  # first request creates the row
        return current

    def found(row):
        if row is None:
            raise HTTPException(status_code=404, detail="Not found.")
        return row

    catalog, study = container.catalog, container.study

    # --- me ----------------------------------------------------------------------

    @app.get("/me", response_model=schemas.MeOut)
    def get_me(me: CurrentUser = Depends(user)):
        return catalog.get_user(me.id)

    @app.patch("/me", response_model=schemas.MeOut)
    def update_me(body: schemas.MeUpdate, me: CurrentUser = Depends(user)):
        return catalog.update_user_name(me.id, body.name)

    # --- projects ------------------------------------------------------------------

    @app.get("/projects", response_model=list[schemas.ProjectOut])
    def list_projects(me: CurrentUser = Depends(user)):
        return catalog.list_projects(me.id)

    @app.post("/projects", response_model=schemas.ProjectOut, status_code=status.HTTP_201_CREATED)
    def create_project(body: schemas.ProjectIn, me: CurrentUser = Depends(user)):
        return catalog.create_project(me.id, body.name, body.description)

    @app.patch("/projects/{project_id}", response_model=schemas.ProjectOut)
    def update_project(project_id: uuid.UUID, body: schemas.ProjectUpdate, me: CurrentUser = Depends(user)):
        return found(catalog.update_project(me.id, str(project_id), body.model_dump(exclude_unset=True)))

    @app.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_project(project_id: uuid.UUID, me: CurrentUser = Depends(user)):
        for document in found(catalog.delete_project(me.id, str(project_id))):
            container.storage.delete_document_objects(str(document["id"]), document["s3_key"])
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    # --- documents -----------------------------------------------------------------

    @app.get("/projects/{project_id}/documents", response_model=list[schemas.DocumentOut])
    def list_documents(project_id: uuid.UUID, me: CurrentUser = Depends(user)):
        return found(catalog.list_documents(me.id, str(project_id)))

    @app.post(
        "/projects/{project_id}/documents",
        response_model=schemas.DocumentCreatedOut,
        status_code=status.HTTP_201_CREATED,
    )
    def create_document(project_id: uuid.UUID, body: schemas.DocumentIn, me: CurrentUser = Depends(user)):
        count = found(catalog.count_documents(me.id, str(project_id)))
        if count >= schemas.MAX_DOCUMENTS_PER_PROJECT:
            raise HTTPException(
                status_code=409, detail=f"A project holds at most {schemas.MAX_DOCUMENTS_PER_PROJECT} documents."
            )
        document_id = str(uuid.uuid4())
        s3_key = f"users/{me.id}/projects/{project_id}/{document_id}.pdf"
        document = catalog.create_document(document_id, str(project_id), body.name, s3_key, body.size_bytes)
        upload = container.storage.create_upload(s3_key, schemas.MAX_UPLOAD_BYTES)
        return {"document": document, "upload": upload}

    @app.get("/documents/{document_id}", response_model=schemas.DocumentOut)
    def get_document(document_id: uuid.UUID, me: CurrentUser = Depends(user)):
        return found(catalog.get_document(me.id, str(document_id)))

    @app.patch("/documents/{document_id}", response_model=schemas.DocumentOut)
    def rename_document(document_id: uuid.UUID, body: schemas.DocumentUpdate, me: CurrentUser = Depends(user)):
        return found(catalog.rename_document(me.id, str(document_id), body.name))

    @app.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_document(document_id: uuid.UUID, me: CurrentUser = Depends(user)):
        s3_key = found(catalog.delete_document(me.id, str(document_id)))
        container.storage.delete_document_objects(str(document_id), s3_key)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    # --- study artifacts -------------------------------------------------------------

    def owned_document(document_id: uuid.UUID, me: CurrentUser) -> str:
        return str(found(catalog.get_document(me.id, str(document_id)))["id"])

    def queued(kind: str, create) -> str:
        try:
            generation_id = create()
        except DocumentNotReady as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        container.queue.enqueue(kind, generation_id)
        return generation_id

    @app.post("/documents/{document_id}/summaries", response_model=schemas.SummaryOut, status_code=status.HTTP_202_ACCEPTED)
    def request_summary(document_id: uuid.UUID, me: CurrentUser = Depends(user)):
        doc = owned_document(document_id, me)
        return catalog.get_summary(me.id, queued("summary", lambda: study.create_summary(doc)))

    @app.get("/documents/{document_id}/summaries", response_model=list[schemas.SummaryOut])
    def list_summaries(document_id: uuid.UUID, me: CurrentUser = Depends(user)):
        return catalog.list_summaries(me.id, owned_document(document_id, me))

    @app.get("/summaries/{summary_id}", response_model=schemas.SummaryOut)
    def get_summary(summary_id: uuid.UUID, me: CurrentUser = Depends(user)):
        return found(catalog.get_summary(me.id, str(summary_id)))

    @app.post(
        "/documents/{document_id}/flashcard-decks", response_model=schemas.DeckOut, status_code=status.HTTP_202_ACCEPTED
    )
    def request_flashcards(document_id: uuid.UUID, body: schemas.SetRequest, me: CurrentUser = Depends(user)):
        doc = owned_document(document_id, me)
        deck_id = queued("flashcards", lambda: study.create_flashcards(doc, count=body.count, topic=body.topic))
        return catalog.get_deck(me.id, deck_id)

    @app.get("/documents/{document_id}/flashcard-decks", response_model=list[schemas.DeckOut])
    def list_decks(document_id: uuid.UUID, me: CurrentUser = Depends(user)):
        return catalog.list_decks(me.id, owned_document(document_id, me))

    @app.get("/flashcard-decks/{deck_id}", response_model=schemas.DeckOut)
    def get_deck(deck_id: uuid.UUID, me: CurrentUser = Depends(user)):
        return found(catalog.get_deck(me.id, str(deck_id)))

    @app.post("/documents/{document_id}/quizzes", response_model=schemas.QuizOut, status_code=status.HTTP_202_ACCEPTED)
    def request_quiz(document_id: uuid.UUID, body: schemas.SetRequest, me: CurrentUser = Depends(user)):
        doc = owned_document(document_id, me)
        quiz_id = queued("quiz", lambda: study.create_quiz(doc, count=body.count, topic=body.topic))
        return catalog.get_quiz(me.id, quiz_id)

    @app.get("/documents/{document_id}/quizzes", response_model=list[schemas.QuizOut])
    def list_quizzes(document_id: uuid.UUID, me: CurrentUser = Depends(user)):
        return catalog.list_quizzes(me.id, owned_document(document_id, me))

    @app.get("/quizzes/{quiz_id}", response_model=schemas.QuizOut)
    def get_quiz(quiz_id: uuid.UUID, me: CurrentUser = Depends(user)):
        return found(catalog.get_quiz(me.id, str(quiz_id)))

    @app.post("/quizzes/{quiz_id}/attempts", response_model=schemas.AttemptOut, status_code=status.HTTP_201_CREATED)
    def grade_quiz(quiz_id: uuid.UUID, body: schemas.AttemptIn, me: CurrentUser = Depends(user)):
        found(catalog.get_quiz(me.id, str(quiz_id)))
        try:
            result = study.grade_quiz(str(quiz_id), body.answers)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        return asdict(result)

    def editable(edit):
        try:
            return edit()
        except StillGenerating as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.patch("/flashcard-decks/{deck_id}", response_model=schemas.DeckOut)
    def rename_deck(deck_id: uuid.UUID, body: schemas.SetUpdate, me: CurrentUser = Depends(user)):
        return found(editable(lambda: catalog.rename_deck(me.id, str(deck_id), body.topic)))

    @app.delete("/flashcard-decks/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_deck(deck_id: uuid.UUID, me: CurrentUser = Depends(user)):
        if not editable(lambda: catalog.delete_deck(me.id, str(deck_id))):
            raise HTTPException(status_code=404, detail="Not found.")
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @app.patch("/quizzes/{quiz_id}", response_model=schemas.QuizOut)
    def rename_quiz(quiz_id: uuid.UUID, body: schemas.SetUpdate, me: CurrentUser = Depends(user)):
        return found(editable(lambda: catalog.rename_quiz(me.id, str(quiz_id), body.topic)))

    @app.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_quiz(quiz_id: uuid.UUID, me: CurrentUser = Depends(user)):
        if not editable(lambda: catalog.delete_quiz(me.id, str(quiz_id))):
            raise HTTPException(status_code=404, detail="Not found.")
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    # --- conversations ---------------------------------------------------------------

    @app.get("/projects/{project_id}/conversations", response_model=list[schemas.ConversationOut])
    def list_conversations(project_id: uuid.UUID, me: CurrentUser = Depends(user)):
        return found(catalog.list_conversations(me.id, str(project_id)))

    @app.post(
        "/projects/{project_id}/conversations", response_model=schemas.ConversationOut, status_code=status.HTTP_201_CREATED
    )
    def create_conversation(project_id: uuid.UUID, body: schemas.ConversationIn, me: CurrentUser = Depends(user)):
        return found(catalog.create_conversation(me.id, str(project_id), body.title))

    @app.get("/conversations/{conversation_id}/messages", response_model=list[schemas.MessageOut])
    def list_messages(conversation_id: uuid.UUID, me: CurrentUser = Depends(user)):
        return found(catalog.list_messages(me.id, str(conversation_id)))

    @app.patch("/conversations/{conversation_id}", response_model=schemas.ConversationOut)
    def rename_conversation(conversation_id: uuid.UUID, body: schemas.ConversationUpdate, me: CurrentUser = Depends(user)):
        return found(catalog.rename_conversation(me.id, str(conversation_id), body.title))

    @app.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_conversation(conversation_id: uuid.UUID, me: CurrentUser = Depends(user)):
        if not catalog.delete_conversation(me.id, str(conversation_id)):
            raise HTTPException(status_code=404, detail="Not found.")
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return app


def _add_local_upload_route(app: FastAPI, uploads) -> None:
    from fastapi import File, Form, UploadFile

    from entrypoints.api.local_uploads import UploadRejected

    @app.post("/local-uploads", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
    async def local_upload(key: str = Form(...), file: UploadFile = File(...)):
        content = await file.read()
        try:
            uploads.receive(key, content, file.content_type)
        except UploadRejected as error:
            raise HTTPException(status_code=error.status_code, detail=error.detail) from error
        return Response(status_code=status.HTTP_204_NO_CONTENT)
