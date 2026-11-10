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

    def create_upload(self, s3_key: str, max_bytes: int, expires_in: int = 900) -> dict:
        """Presigned POST: unlike a presigned PUT, it can enforce the content type and a size limit."""
        return self.client.generate_presigned_post(
            Bucket=self.bucket,
            Key=s3_key,
            Fields={"Content-Type": "application/pdf"},
            Conditions=[{"Content-Type": "application/pdf"}, ["content-length-range", 1, max_bytes]],
            ExpiresIn=expires_in,
        )

    def delete_document_objects(self, document_id: str, s3_key: str) -> None:
        self.client.delete_objects(
            Bucket=self.bucket,
            Delete={"Objects": [{"Key": s3_key}, {"Key": pages_key(document_id)}]},
        )

    def load_pages(self, document_id: str) -> list[Page]:
        with self.client.get_object(Bucket=self.bucket, Key=pages_key(document_id))["Body"] as body:
            return [Page(number=item["number"], text=item["text"]) for item in json.loads(body.read())]

    def save_pages(self, document_id: str, pages: list[Page]) -> None:
        payload = [{"number": page.number, "text": page.text} for page in pages]
        self.client.put_object(
            Bucket=self.bucket,
            Key=pages_key(document_id),
            Body=json.dumps(payload, ensure_ascii=False).encode(),
            ContentType="application/json",
        )
