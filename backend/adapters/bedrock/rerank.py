COHERE_RERANK_V3_5 = "cohere.rerank-v3-5:0"


class BedrockReranker:
    """Bedrock Rerank API (bedrock-agent-runtime) with a serverless reranking model."""

    def __init__(self, client, model_id: str = COHERE_RERANK_V3_5):
        self.client = client
        self.model_arn = f"arn:aws:bedrock:{client.meta.region_name}::foundation-model/{model_id}"

    def rerank(self, query: str, documents: list[str], top_n: int) -> list[tuple[int, float]]:
        response = self.client.rerank(
            queries=[{"type": "TEXT", "textQuery": {"text": query}}],
            sources=[
                {"type": "INLINE", "inlineDocumentSource": {"type": "TEXT", "textDocument": {"text": document}}}
                for document in documents
            ],
            rerankingConfiguration={
                "type": "BEDROCK_RERANKING_MODEL",
                "bedrockRerankingConfiguration": {
                    "modelConfiguration": {"modelArn": self.model_arn},
                    "numberOfResults": min(top_n, len(documents)),
                },
            },
        )
        return [(result["index"], result["relevanceScore"]) for result in response["results"]]
