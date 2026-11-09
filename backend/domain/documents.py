from dataclasses import dataclass


@dataclass(frozen=True)
class Page:
    number: int  # 1-based, as shown to the user
    text: str


@dataclass(frozen=True)
class Chunk:
    index: int
    page_number: int  # page where the chunk starts
    content: str
