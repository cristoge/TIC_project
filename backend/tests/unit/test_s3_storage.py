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


def _signing_client():
    return boto3.client(
        "s3", region_name="eu-central-1", aws_access_key_id="test", aws_secret_access_key="test"
    )


def test_create_upload_restricts_type_and_size():
    upload = S3DocumentStorage(_signing_client(), "docs").create_upload("users/u/projects/p/d.pdf", max_bytes=1000)

    assert upload["url"].startswith("https://docs.s3")
    assert upload["fields"]["key"] == "users/u/projects/p/d.pdf"
    assert upload["fields"]["Content-Type"] == "application/pdf"
    policy = json.loads(__import__("base64").b64decode(upload["fields"]["policy"]))
    assert ["content-length-range", 1, 1000] in policy["conditions"]
    assert {"Content-Type": "application/pdf"} in policy["conditions"]


def test_delete_document_objects_removes_the_pdf_and_its_page_texts():
    client = _client()
    with Stubber(client) as stub:
        stub.add_response(
            "delete_objects",
            {},
            expected_params={
                "Bucket": "docs",
                "Delete": {"Objects": [{"Key": "users/u/projects/p/d.pdf"}, {"Key": "documents/d/pages.json"}]},
            },
        )

        S3DocumentStorage(client, "docs").delete_document_objects("d", "users/u/projects/p/d.pdf")
        stub.assert_no_pending_responses()


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
