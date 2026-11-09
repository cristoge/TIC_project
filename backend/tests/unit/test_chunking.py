from domain.documents import Page
from services.chunking import split_into_chunks


def _sentences(prefix, count):
    return " ".join(f"{prefix} sentence number {i} explains one idea." for i in range(count))


def test_short_document_becomes_a_single_chunk_on_its_page():
    chunks = split_into_chunks([Page(number=1, text="Mitosis divides the nucleus.")])

    assert [(c.index, c.page_number, c.content) for c in chunks] == [
        (0, 1, "Mitosis divides the nucleus.")
    ]


def test_chunks_never_exceed_the_chunk_size():
    pages = [Page(number=1, text=_sentences("Alpha", 200))]

    chunks = split_into_chunks(pages, chunk_size=300, chunk_overlap=45)

    assert len(chunks) > 1
    assert all(len(c.content) <= 300 for c in chunks)
    assert [c.index for c in chunks] == list(range(len(chunks)))


def test_consecutive_chunks_overlap():
    pages = [Page(number=1, text=_sentences("Alpha", 200))]

    chunks = split_into_chunks(pages, chunk_size=300, chunk_overlap=60)

    for previous, current in zip(chunks, chunks[1:]):
        first_words = current.content.split(" ")[0:3]
        assert " ".join(first_words) in previous.content


def test_every_word_of_the_document_ends_up_in_some_chunk():
    text = _sentences("Alpha", 120)
    chunks = split_into_chunks([Page(number=1, text=text)], chunk_size=250, chunk_overlap=40)

    joined = " ".join(c.content for c in chunks)
    assert set(text.split()) <= set(joined.split())


def test_each_chunk_gets_the_page_where_it_starts():
    pages = [
        Page(number=1, text=_sentences("First", 20)),
        Page(number=2, text=_sentences("Second", 20)),
        Page(number=3, text=_sentences("Third", 20)),
    ]

    chunks = split_into_chunks(pages, chunk_size=200, chunk_overlap=0)

    for chunk in chunks:
        first_word = chunk.content.split()[0]
        expected_page = {"First": 1, "Second": 2, "Third": 3}[first_word]
        assert chunk.page_number == expected_page


def test_paragraph_breaks_are_preferred_over_cutting_sentences():
    paragraph_a = "A" * 150 + "."
    paragraph_b = "B" * 150 + "."
    pages = [Page(number=1, text=f"{paragraph_a}\n\n{paragraph_b}")]

    chunks = split_into_chunks(pages, chunk_size=200, chunk_overlap=0)

    assert [c.content for c in chunks] == [paragraph_a, paragraph_b]


def test_blank_pages_produce_no_chunks():
    pages = [Page(number=1, text="   \n"), Page(number=2, text="")]

    assert split_into_chunks(pages) == []


def test_text_after_blank_pages_keeps_its_real_page_number():
    pages = [Page(number=1, text=""), Page(number=2, text="\n"), Page(number=3, text="Only text.")]

    (chunk,) = split_into_chunks(pages)

    assert chunk.page_number == 3
