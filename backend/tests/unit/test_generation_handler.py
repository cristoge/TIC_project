import json

from entrypoints.generation.handler import handle


class FakeStudy:
    def __init__(self, failing=()):
        self.calls = []
        self.failing = set(failing)

    def _run(self, kind, generation_id):
        self.calls.append((kind, generation_id))
        if generation_id in self.failing:
            raise RuntimeError("boom")

    def generate_summary(self, generation_id):
        self._run("summary", generation_id)

    def generate_flashcards(self, generation_id):
        self._run("flashcards", generation_id)

    def generate_quiz(self, generation_id):
        self._run("quiz", generation_id)


def _record(message_id, kind, generation_id):
    return {"messageId": message_id, "body": json.dumps({"kind": kind, "id": generation_id})}


def test_each_job_runs_the_matching_generation():
    study = FakeStudy()
    event = {"Records": [_record("m1", "summary", "s1"), _record("m2", "flashcards", "f1"), _record("m3", "quiz", "q1")]}

    assert handle(event, study) == {"batchItemFailures": []}
    assert study.calls == [("summary", "s1"), ("flashcards", "f1"), ("quiz", "q1")]


def test_failing_and_unknown_jobs_are_reported_for_retry():
    study = FakeStudy(failing={"s1"})
    event = {"Records": [_record("m1", "summary", "s1"), _record("m2", "poem", "x1"), _record("m3", "quiz", "q1")]}

    result = handle(event, study)

    assert result == {"batchItemFailures": [{"itemIdentifier": "m1"}, {"itemIdentifier": "m2"}]}
    assert study.calls == [("summary", "s1"), ("quiz", "q1")]
