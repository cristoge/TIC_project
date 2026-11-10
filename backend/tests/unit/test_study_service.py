import random

import pytest

from domain.documents import Page
from domain.search import SearchResult
from domain.study import Flashcard, FlashcardSet, KeyTerm, Quiz, QuizQuestion, Summary, SummarySection
from services.study import (
    UNEXPECTED_ERROR_MESSAGE,
    DocumentInfo,
    DocumentNotReady,
    GenerationRequest,
    StoredQuestion,
    StudyService,
)


class FakeRepository:
    def __init__(self, status="ready", page_count=3, previous_questions=()):
        self.document = DocumentInfo(project_id="p1", page_count=page_count, status=status)
        self.requests = {}
        self.completed = {}
        self.failed = {}
        self.previous = list(previous_questions)
        self.questions = []
        self.attempts = []

    def get_document(self, document_id):
        return self.document

    def create_generation(self, kind, document_id, model, topic=None, requested_count=None):
        generation_id = f"{kind}-1"
        self.requests[generation_id] = GenerationRequest(document_id, topic, requested_count)
        return generation_id

    def get_request(self, kind, generation_id):
        return self.requests[generation_id]

    def complete_summary(self, summary_id, content):
        self.completed[summary_id] = content

    def complete_deck(self, deck_id, cards):
        self.completed[deck_id] = cards

    def complete_quiz(self, quiz_id, questions):
        self.completed[quiz_id] = questions

    def fail_generation(self, kind, generation_id, message):
        self.failed[generation_id] = message

    def previous_questions(self, document_id):
        return self.previous

    def quiz_questions(self, quiz_id):
        return self.questions

    def save_attempt(self, quiz_id, score, total, answers):
        self.attempts.append((quiz_id, score, total, answers))
        return "attempt-1"


class FakePages:
    def __init__(self, pages):
        self.pages = pages

    def load_pages(self, document_id):
        return self.pages


class FakeSearch:
    def __init__(self, results=()):
        self.results = list(results)
        self.calls = []

    def search(self, project_id, query, document_ids=None):
        self.calls.append((project_id, query, document_ids))
        return self.results


class FakeLLM:
    def __init__(self, output=None, error=None):
        self.output = output
        self.error = error
        self.calls = []

    def generate(self, instructions, content, output_type, temperature):
        self.calls.append({"instructions": instructions, "content": content, "type": output_type, "temperature": temperature})
        if self.error:
            raise self.error
        return self.output


PAGES = [Page(1, "Mitosis basics."), Page(2, "Meiosis basics."), Page(3, "Differences.")]


def _service(llm, repository=None, pages=PAGES, search=None):
    return StudyService(
        repository=repository or FakeRepository(),
        pages=FakePages(pages),
        search=search or FakeSearch(),
        llm=llm,
        model_id="nova",
        rng=random.Random(7),
    )


SUMMARY = Summary(
    overview="Cell division.",
    sections=[SummarySection(heading="Mitosis", points=["Two identical cells."], pages=[1])],
    key_terms=[KeyTerm(term="Mitosis", definition="Division into two identical cells.")],
)


# --- summary -------------------------------------------------------------------


def test_creating_any_study_artifact_requires_a_ready_document():
    service = _service(FakeLLM(), repository=FakeRepository(status="processing"))

    with pytest.raises(DocumentNotReady):
        service.create_summary("doc-1")


def test_generate_summary_sends_the_page_tagged_text_and_stores_the_structured_result():
    llm = FakeLLM(output=SUMMARY)
    repository = FakeRepository()
    service = _service(llm, repository)
    summary_id = service.create_summary("doc-1")

    service.generate_summary(summary_id)

    call = llm.calls[0]
    assert call["type"] is Summary
    assert call["temperature"] == 0.3
    assert call["content"] == "[Page 1]\nMitosis basics.\n\n[Page 2]\nMeiosis basics.\n\n[Page 3]\nDifferences."
    assert repository.completed[summary_id] == SUMMARY.model_dump()


def test_summary_of_a_document_that_is_too_long_fails_without_calling_the_model():
    llm = FakeLLM(output=SUMMARY)
    repository = FakeRepository()
    service = _service(llm, repository, pages=[Page(1, "x" * 2_000_000)])
    summary_id = service.create_summary("doc-1")

    service.generate_summary(summary_id)

    assert llm.calls == []
    assert repository.failed[summary_id] == "The document is too long to summarize."


def test_unexpected_model_error_marks_the_generation_failed_and_propagates_for_a_retry():
    repository = FakeRepository()
    service = _service(FakeLLM(error=RuntimeError("throttled")), repository)
    summary_id = service.create_summary("doc-1")

    with pytest.raises(RuntimeError):
        service.generate_summary(summary_id)

    assert repository.failed[summary_id] == UNEXPECTED_ERROR_MESSAGE


# --- flashcards ----------------------------------------------------------------


def test_flashcard_count_must_be_reasonable():
    service = _service(FakeLLM())

    with pytest.raises(ValueError):
        service.create_flashcards("doc-1", count=0)
    with pytest.raises(ValueError):
        service.create_flashcards("doc-1", count=31)


def test_flashcards_without_topic_use_the_document_pages_and_avoid_previous_questions():
    llm = FakeLLM(output=FlashcardSet(cards=[Flashcard(question="What is mitosis?", answer="A division.", page=1)]))
    repository = FakeRepository(previous_questions=["What is meiosis?"])
    service = _service(llm, repository)
    deck_id = service.create_flashcards("doc-1", count=5)

    service.generate_flashcards(deck_id)

    call = llm.calls[0]
    assert call["temperature"] == 0.7
    assert "[Page 1]\nMitosis basics." in call["content"]
    assert "What is meiosis?" in call["content"]
    assert "5" in call["instructions"]


def test_flashcards_with_topic_use_the_search_restricted_to_the_document():
    search = FakeSearch(
        [SearchResult("c1", "doc-1", "Tema3.pdf", 2, "Meiosis produces gametes.", 0.03, 0.8, 0.9)]
    )
    llm = FakeLLM(output=FlashcardSet(cards=[Flashcard(question="What does meiosis produce?", answer="Gametes.", page=2)]))
    service = _service(llm, search=search)
    deck_id = service.create_flashcards("doc-1", count=5, topic="meiosis")

    service.generate_flashcards(deck_id)

    assert search.calls == [("p1", "meiosis", ["doc-1"])]
    assert llm.calls[0]["content"].startswith("[Page 2]\nMeiosis produces gametes.")


def test_topic_not_found_in_the_document_fails_without_calling_the_model():
    llm = FakeLLM()
    repository = FakeRepository()
    service = _service(llm, repository, search=FakeSearch([]))
    deck_id = service.create_flashcards("doc-1", count=5, topic="photosynthesis")

    service.generate_flashcards(deck_id)

    assert llm.calls == []
    assert repository.failed[deck_id] == "Nothing about 'photosynthesis' was found in the document."


def test_flashcards_are_validated_before_saving():
    cards = [
        Flashcard(question="What is mitosis?", answer="A division.", page=1),
        Flashcard(question="what is MITOSIS? ", answer="Duplicate.", page=1),  # duplicate in the deck
        Flashcard(question="What is meiosis?", answer="Repeated from an old deck.", page=2),  # previous deck
        Flashcard(question="Q" * 201, answer="Too long question.", page=1),
        Flashcard(question="", answer="Empty question.", page=1),
        Flashcard(question="What is anaphase?", answer="A phase.", page=99),  # page clamped to the last page
        Flashcard(question="What is telophase?", answer="A phase.", page=3),
        Flashcard(question="What is prophase?", answer="Beyond the requested count.", page=1),
    ]
    repository = FakeRepository(previous_questions=["What is meiosis?"])
    service = _service(FakeLLM(output=FlashcardSet(cards=cards)), repository)
    deck_id = service.create_flashcards("doc-1", count=3)

    service.generate_flashcards(deck_id)

    saved = repository.completed[deck_id]
    assert [(c.question, c.page) for c in saved] == [
        ("What is mitosis?", 1),
        ("What is anaphase?", 3),
        ("What is telophase?", 3),
    ]


def test_deck_without_any_valid_card_fails():
    repository = FakeRepository(previous_questions=["What is mitosis?"])
    output = FlashcardSet(cards=[Flashcard(question="What is mitosis?", answer="Again.", page=1)])
    service = _service(FakeLLM(output=output), repository)
    deck_id = service.create_flashcards("doc-1", count=3)

    service.generate_flashcards(deck_id)

    assert repository.failed[deck_id] == "No valid flashcards could be generated."


# --- quiz ----------------------------------------------------------------------


def test_quiz_questions_are_validated_and_their_options_shuffled():
    questions = [
        QuizQuestion(question="Mitosis produces?", options=["Two cells", "Four cells", "One cell", "Eight cells"],
                     correct_index=0, explanation="Two identical cells.", page=1),
        QuizQuestion(question="Three options?", options=["a", "b", "c"], correct_index=0, explanation="x", page=1),
        QuizQuestion(question="Duplicate options?", options=["a", "A", "b", "c"], correct_index=0, explanation="x", page=1),
        QuizQuestion(question="Bad index?", options=["a", "b", "c", "d"], correct_index=4, explanation="x", page=1),
    ]
    repository = FakeRepository()
    service = _service(FakeLLM(output=Quiz(questions=questions)), repository)
    quiz_id = service.create_quiz("doc-1", count=5)

    service.generate_quiz(quiz_id)

    (saved,) = repository.completed[quiz_id]
    assert saved.question == "Mitosis produces?"
    assert sorted(saved.options) == sorted(["Two cells", "Four cells", "One cell", "Eight cells"])
    assert saved.options[saved.correct_index] == "Two cells"


def test_shuffling_spreads_the_correct_answer_across_positions():
    question = QuizQuestion(question="Q", options=["right", "w1", "w2", "w3"], correct_index=0, explanation="e", page=1)
    questions = [question.model_copy(update={"question": f"Q{i}"}) for i in range(20)]
    repository = FakeRepository()
    service = _service(FakeLLM(output=Quiz(questions=questions)), repository)
    quiz_id = service.create_quiz("doc-1", count=20)

    service.generate_quiz(quiz_id)

    positions = {q.correct_index for q in repository.completed[quiz_id]}
    assert len(positions) > 1


def test_grade_quiz_scores_every_answer_and_saves_the_attempt():
    repository = FakeRepository()
    repository.questions = [
        StoredQuestion(id="q1", correct_index=2, explanation="Because 2."),
        StoredQuestion(id="q2", correct_index=0, explanation="Because 0."),
    ]
    service = _service(FakeLLM(), repository)

    result = service.grade_quiz("quiz-1", {"q1": 2, "q2": 3})

    assert (result.attempt_id, result.score, result.total) == ("attempt-1", 1, 2)
    assert [(a.question_id, a.selected_index, a.correct_index, a.is_correct, a.explanation) for a in result.answers] == [
        ("q1", 2, 2, True, "Because 2."),
        ("q2", 3, 0, False, "Because 0."),
    ]
    assert repository.attempts == [("quiz-1", 1, 2, result.answers)]


def test_grade_quiz_requires_an_answer_for_every_question():
    repository = FakeRepository()
    repository.questions = [StoredQuestion("q1", 0, "e"), StoredQuestion("q2", 1, "e")]
    service = _service(FakeLLM(), repository)

    with pytest.raises(ValueError):
        service.grade_quiz("quiz-1", {"q1": 0})
    with pytest.raises(ValueError):
        service.grade_quiz("quiz-1", {"q1": 0, "q2": 4})
    assert repository.attempts == []
