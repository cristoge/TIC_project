import json

from entrypoints.ingest.handler import handle


class FakeLookup:
    def __init__(self, known):
        self.known = known

    def find_id_by_s3_key(self, s3_key):
        return self.known.get(s3_key)


class FakeService:
    def __init__(self, failing_keys=()):
        self.calls = []
        self.failing_keys = set(failing_keys)

    def ingest(self, document_id, s3_key):
        self.calls.append((document_id, s3_key))
        if s3_key in self.failing_keys:
            raise RuntimeError("boom")
        return 3


def _record(message_id, *keys):
    body = {
        "Records": [
            {"eventSource": "aws:s3", "s3": {"bucket": {"name": "docs"}, "object": {"key": key}}}
            for key in keys
        ]
    }
    return {"messageId": message_id, "body": json.dumps(body)}


def test_each_uploaded_object_is_ingested_with_its_document_id():
    service = FakeService()
    lookup = FakeLookup({"users/u/projects/p/a.pdf": "doc-a"})

    result = handle({"Records": [_record("m1", "users/u/projects/p/a.pdf")]}, service, lookup)

    assert service.calls == [("doc-a", "users/u/projects/p/a.pdf")]
    assert result == {"batchItemFailures": []}


def test_object_keys_are_url_decoded():
    service = FakeService()
    lookup = FakeLookup({"users/u/projects/p/my notes.pdf": "doc-a"})

    handle({"Records": [_record("m1", "users/u/projects/p/my+notes.pdf")]}, service, lookup)

    assert service.calls == [("doc-a", "users/u/projects/p/my notes.pdf")]


def test_s3_test_event_is_ignored():
    service = FakeService()
    record = {"messageId": "m1", "body": json.dumps({"Event": "s3:TestEvent", "Bucket": "docs"})}

    result = handle({"Records": [record]}, service, FakeLookup({}))

    assert service.calls == []
    assert result == {"batchItemFailures": []}


def test_object_without_a_document_row_is_skipped():
    service = FakeService()

    result = handle({"Records": [_record("m1", "users/u/projects/p/orphan.pdf")]}, service, FakeLookup({}))

    assert service.calls == []
    assert result == {"batchItemFailures": []}


def test_only_the_failing_message_is_reported_for_retry():
    service = FakeService(failing_keys={"k/bad.pdf"})
    lookup = FakeLookup({"k/good.pdf": "doc-good", "k/bad.pdf": "doc-bad"})
    event = {"Records": [_record("m-good", "k/good.pdf"), _record("m-bad", "k/bad.pdf")]}

    result = handle(event, service, lookup)

    assert result == {"batchItemFailures": [{"itemIdentifier": "m-bad"}]}
