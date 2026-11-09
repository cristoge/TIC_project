import pymupdf

from adapters.pdf.pymupdf_reader import PyMuPdfReader


def _pdf(*page_texts):
    document = pymupdf.open()
    for text in page_texts:
        page = document.new_page()
        if text:
            page.insert_text((72, 72), text)
    return document.tobytes()


def test_extract_pages_returns_numbered_page_texts():
    pages = PyMuPdfReader().extract_pages(_pdf("Mitosis", "", "Meiosis"))

    assert [page.number for page in pages] == [1, 2, 3]
    assert pages[0].text.strip() == "Mitosis"
    assert pages[1].text.strip() == ""
    assert pages[2].text.strip() == "Meiosis"
