"""Page-aware recursive text splitting.

The pages are joined into one text so no idea is cut at a page break; each
chunk remembers the page where it starts, which is what citations show.
"""

from bisect import bisect_right
from itertools import accumulate

from domain.documents import Chunk, Page

PAGE_SEPARATOR = "\n\n"
# Coarsest first: paragraphs, lines, sentences, words.
SEPARATORS = ("\n\n", "\n", ". ", " ")


def split_into_chunks(pages: list[Page], chunk_size: int = 1100, chunk_overlap: int = 165) -> list[Chunk]:
    text, page_starts = _join_pages(pages)
    pieces = _split(text, chunk_size, SEPARATORS)
    piece_starts = [0, *accumulate(len(piece) for piece in pieces)]

    chunks: list[Chunk] = []
    start = 0
    while start < len(pieces):
        end, length = start, 0
        while end < len(pieces) and length + len(pieces[end]) <= chunk_size:
            length += len(pieces[end])
            end += 1

        raw = "".join(pieces[start:end])
        content = raw.strip()
        if content:
            first_char = piece_starts[start] + len(raw) - len(raw.lstrip())
            page_number = pages[bisect_right(page_starts, first_char) - 1].number
            chunks.append(Chunk(index=len(chunks), page_number=page_number, content=content))

        if end >= len(pieces):
            break
        start = _overlap_start(pieces, start, end, chunk_overlap)
    return chunks


def _join_pages(pages: list[Page]) -> tuple[str, list[int]]:
    texts = [page.text for page in pages]
    page_starts = []
    offset = 0
    for page_text in texts:
        page_starts.append(offset)
        offset += len(page_text) + len(PAGE_SEPARATOR)
    return PAGE_SEPARATOR.join(texts), page_starts


def _split(text: str, size: int, separators: tuple[str, ...]) -> list[str]:
    """Split into pieces no longer than size whose concatenation is exactly text."""
    if len(text) <= size:
        return [text]
    for position, separator in enumerate(separators):
        if separator not in text:
            continue
        parts = text.split(separator)
        pieces = []
        for number, part in enumerate(parts):
            piece = part + separator if number < len(parts) - 1 else part
            pieces.extend(_split(piece, size, separators[position + 1 :]))
        return pieces
    return [text[offset : offset + size] for offset in range(0, len(text), size)]


def _overlap_start(pieces: list[str], start: int, end: int, chunk_overlap: int) -> int:
    """Step back from end while the repeated pieces fit in the overlap budget."""
    next_start, overlap = end, 0
    while next_start - 1 > start and overlap + len(pieces[next_start - 1]) <= chunk_overlap:
        next_start -= 1
        overlap += len(pieces[next_start])
    return next_start
