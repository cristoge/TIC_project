import httpx


class OllamaEmbedder:
    """Local embeddings through Ollama's /api/embed (several texts per call).

    Vectors from different models live in different spaces: a database ingested
    with this embedder must also be searched with it.
    """

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "embeddinggemma-2:270m",
        dimensions: int = 512,
        batch_size: int = 32,
        client: httpx.Client | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.model_id = f"ollama/{model}"
        self.dimensions = dimensions
        self.batch_size = batch_size
        self.client = client or httpx.Client(timeout=120)

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors = []
        for start in range(0, len(texts), self.batch_size):
            response = self.client.post(
                f"{self.base_url}/api/embed",
                json={"model": self.model, "input": texts[start : start + self.batch_size], "dimensions": self.dimensions},
            )
            response.raise_for_status()
            vectors.extend(response.json()["embeddings"])
        return vectors
