from domain.search import SearchResult
from services.agent_tools import AgentTools, TurnRecorder
from services.study import DocumentNotReady

PROJECT = "p1"
DOCS = [
    {"id": "d1", "name": "Tema3.pdf", "status": "ready", "page_count": 20},
    {"id": "d2", "name": "Tema4.pdf", "status": "processing", "page_count": None},
]


class FakeDocuments:
    def list_documents_of_project(self, project_id):
        assert project_id == PROJECT
        return DOCS


class FakeSearch:
    def __init__(self, results):
        self.results = results
        self.calls = []

    def search(self, project_id, query, document_ids=None):
        self.calls.append((project_id, query, document_ids))
        return self.results


class FakeStudy:
    def __init__(self, fail_with=None, not_ready=False):
        self.calls = []
        self.fail_with = fail_with
        self.not_ready = not_ready

    def create_summary(self, document_id):
        if self.not_ready:
            raise DocumentNotReady("The document is not ready yet.")
        self.calls.append(("create_summary", document_id))
        return "s1"

    def generate_summary(self, summary_id):
        self.calls.append(("generate_summary", summary_id))

    def create_flashcards(self, document_id, count, topic):
        self.calls.append(("create_flashcards", document_id, count, topic))
        return "f1"

    def generate_flashcards(self, deck_id):
        self.calls.append(("generate_flashcards", deck_id))

    def create_quiz(self, document_id, count, topic):
        self.calls.append(("create_quiz", document_id, count, topic))
        return "q1"

    def generate_quiz(self, quiz_id):
        self.calls.append(("generate_quiz", quiz_id))


class FakeStatus:
    def __init__(self, status="ready", message=None):
        self.value = (status, message)

    def generation_status(self, kind, generation_id):
        return self.value


def _result(chunk, page, content):
    return SearchResult(chunk, "d1", "Tema3.pdf", page, content, 0.03, 0.8, 0.9)


def _tools(results=(), study=None, status=None):
    search = FakeSearch(list(results))
    tools = AgentTools(FakeDocuments(), search, study or FakeStudy(), status or FakeStatus())
    return tools, search


def test_search_numbers_passages_with_their_source_and_records_them():
    tools, search = _tools([_result("c1", 12, "Mitosis divides."), _result("c2", 13, "Telophase ends it.")])
    recorder = TurnRecorder()

    text = tools.search_documents(PROJECT, recorder, "mitosis")

    assert text == "[1] Tema3.pdf, page 12\nMitosis divides.\n\n[2] Tema3.pdf, page 13\nTelophase ends it."
    assert [(s.n, s.chunk_id, s.page) for s in recorder.sources] == [(1, "c1", 12), (2, "c2", 13)]
    assert search.calls == [(PROJECT, "mitosis", None)]


def test_numbering_continues_across_searches_and_reuses_the_number_of_a_repeated_passage():
    recorder = TurnRecorder()
    first, _ = _tools([_result("c1", 12, "A")])
    second, _ = _tools([_result("c2", 3, "B"), _result("c1", 12, "A")])

    first.search_documents(PROJECT, recorder, "a")
    text = second.search_documents(PROJECT, recorder, "b")

    assert text.startswith("[2] Tema3.pdf, page 3\nB\n\n[1] Tema3.pdf, page 12")
    assert [s.n for s in recorder.sources] == [1, 2]


def test_search_rejects_document_ids_outside_the_project():
    tools, search = _tools([_result("c1", 1, "A")])

    text = tools.search_documents(PROJECT, TurnRecorder(), "a", document_ids=["d1", "foreign"])

    assert text == "Unknown document id: foreign. Use list_documents to get valid ids."
    assert search.calls == []


def test_search_without_results_says_so():
    tools, _ = _tools([])

    assert tools.search_documents(PROJECT, TurnRecorder(), "photosynthesis") == (
        "No relevant passages were found in the project's documents."
    )


def test_list_documents_shows_names_ids_and_status():
    tools, _ = _tools()

    assert tools.list_documents(PROJECT) == (
        "- Tema3.pdf (id: d1, status: ready, pages: 20)\n- Tema4.pdf (id: d2, status: processing, pages: ?)"
    )


def test_create_summary_generates_it_now_and_records_the_artifact():
    study = FakeStudy()
    tools, _ = _tools(study=study)
    recorder = TurnRecorder()

    text = tools.create_summary(PROJECT, recorder, "d1")

    assert study.calls == [("create_summary", "d1"), ("generate_summary", "s1")]
    assert recorder.artifacts == {"summary": "s1"}
    assert "do not repeat its content" in text


def test_create_flashcards_and_quiz_pass_count_and_topic():
    study = FakeStudy()
    tools, _ = _tools(study=study)
    recorder = TurnRecorder()

    tools.create_flashcards(PROJECT, recorder, "d1", count=5, topic="mitosis")
    tools.create_quiz(PROJECT, recorder, "d1", count=3)

    assert ("create_flashcards", "d1", 5, "mitosis") in study.calls
    assert ("create_quiz", "d1", 3, None) in study.calls
    assert recorder.artifacts == {"flashcards": "f1", "quiz": "q1"}


def test_failed_generation_is_reported_and_not_recorded_as_an_artifact():
    tools, _ = _tools(status=FakeStatus("failed", "No valid flashcards could be generated."))
    recorder = TurnRecorder()

    text = tools.create_flashcards(PROJECT, recorder, "d1", count=5)

    assert text == "The flashcards could not be created: No valid flashcards could be generated."
    assert recorder.artifacts == {}


def test_creating_from_a_foreign_or_unready_document_is_refused():
    study = FakeStudy(not_ready=True)
    tools, _ = _tools(study=study)

    assert tools.create_summary(PROJECT, TurnRecorder(), "foreign") == (
        "Unknown document id: foreign. Use list_documents to get valid ids."
    )
    assert tools.create_summary(PROJECT, TurnRecorder(), "d1") == "The document is not ready yet."
