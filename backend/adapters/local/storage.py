"""Document storage: uploaded PDFs and their extracted pages, as files under one folder."""

import json
from pathlib import Path

from domain.documents import Page


def pages_key(document_id: str) -> str:
    return f"documents/{document_id}/pages.json"


class LocalDocumentStorage:
    def __init__(self, root: Path | str, public_base_url: str):
        self.root = Path(root).resolve()
        self.public_base_url = public_base_url.rstrip("/")

    def create_upload(self, s3_key: str, max_bytes: int) -> dict:
        """Same shape as an S3 presigned POST; the API's /local-uploads route receives the file."""
        return {"url": f"{self.public_base_url}/local-uploads", "fields": {"key": s3_key}}

    def save_upload(self, s3_key: str, content: bytes) -> None:
        path = self._path(s3_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    def read_pdf(self, s3_key: str) -> bytes:
        return self._path(s3_key).read_bytes()

    def save_pages(self, document_id: str, pages: list[Page]) -> None:
        path = self._path(pages_key(document_id))
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = [{"number": page.number, "text": page.text} for page in pages]
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    def load_pages(self, document_id: str) -> list[Page]:
        payload = json.loads(self._path(pages_key(document_id)).read_text(encoding="utf-8"))
        return [Page(number=item["number"], text=item["text"]) for item in payload]

    def delete_document_objects(self, document_id: str, s3_key: str) -> None:
        for key in (s3_key, pages_key(document_id)):
            self._path(key).unlink(missing_ok=True)

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError(f"Key outside the storage folder: {key}")
        return path
