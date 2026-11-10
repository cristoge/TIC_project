import io
import json

import boto3
from botocore.response import StreamingBody
from botocore.stub import Stubber

from adapters.s3.storage import S3DocumentStorage
from domain.documents import Page


def _client():
    return boto3.client("s3", region_name="eu-central-1")


def test_read_pdf_returns_the_object_bytes():
    client = _client()
    with Stubber(client) as stub:
        stub.add_response(
            "get_object",
            {"Body": StreamingBody(io.BytesIO(b"%PDF-1.7"), 8)},
            expected_params={"Bucket": "docs", "Key": "users/u/projects/p/doc.pdf"},
        )

        assert S3DocumentStorage(client, "docs").read_pdf("users/u/projects/p/doc.pdf") == b"%PDF-1.7"


def test_load_pages_reads_back_the_saved_page_texts():
    client = _client()
    data = json.dumps([{"number": 1, "text": "Uno"}, {"number": 2, "text": "Dos"}]).encode()
    with Stubber(client) as stub:
        stub.add_response(
            "get_object",
            {"Body": StreamingBody(io.BytesIO(data), len(data))},
            expected_params={"Bucket": "docs", "Key": "documents/doc-1/pages.json"},
        )

        assert S3DocumentStorage(client, "docs").load_pages("doc-1") == [Page(1, "Uno"), Page(2, "Dos")]


def test_save_pages_writes_a_json_file_per_document():
    client = _client()
    pages = [Page(1, "Uno"), Page(2, "Dos")]
    with Stubber(client) as stub:
        stub.add_response(
            "put_object",
            {},
            expected_params={
                "Bucket": "docs",
                "Key": "documents/doc-1/pages.json",
                "Body": json.dumps(
                    [{"number": 1, "text": "Uno"}, {"number": 2, "text": "Dos"}], ensure_ascii=False
                ).encode(),
                "ContentType": "application/json",
            },
        )

        S3DocumentStorage(client, "docs").save_pages("doc-1", pages)
        stub.assert_no_pending_responses()
