import pymupdf

from domain.documents import Page


class PyMuPdfReader:
    def extract_pages(self, pdf: bytes) -> list[Page]:
        with pymupdf.open(stream=pdf, filetype="pdf") as document:
            return [Page(number=index + 1, text=page.get_text()) for index, page in enumerate(document)]
