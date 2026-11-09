import json

from domain.documents import Page


def pages_key(document_id: str) -> str:
    return f"documents/{document_id}/pages.json"


class S3DocumentStorage:
    def __init__(self, client, bucket: str):
        self.client = client
        self.bucket = bucket

    def read_pdf(self, s3_key: str) -> bytes:
        with self.client.get_object(Bucket=self.bucket, Key=s3_key)["Body"] as body:
            return body.read()

    def save_pages(self, document_id: str, pages: list[Page]) -> None:
        payload = [{"number": page.number, "text": page.text} for page in pages]
        self.client.put_object(
            Bucket=self.bucket,
            Key=pages_key(document_id),
            Body=json.dumps(payload, ensure_ascii=False).encode(),
            ContentType="application/json",
        )
