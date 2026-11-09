import json
from concurrent.futures import ThreadPoolExecutor

TITAN_V2 = "amazon.titan-embed-text-v2:0"


class TitanEmbedder:
    """Titan Text Embeddings V2 takes one text per call, so calls run in parallel.

    Throttling is retried by the client's own retry configuration (adaptive mode).
    """

    def __init__(self, client, model_id: str = TITAN_V2, dimensions: int = 512, max_workers: int = 8):
        self.client = client
        self.model_id = model_id
        self.dimensions = dimensions
        self.max_workers = max_workers

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        with ThreadPoolExecutor(max_workers=self.max_workers) as pool:
            return list(pool.map(self._embed_one, texts))

    def _embed_one(self, text: str) -> list[float]:
        response = self.client.invoke_model(
            modelId=self.model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({"inputText": text, "dimensions": self.dimensions, "normalize": True}),
        )
        with response["body"] as body:
            return json.loads(body.read())["embedding"]
