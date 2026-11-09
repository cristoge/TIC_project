import boto3
from botocore.stub import Stubber

from adapters.bedrock.rerank import BedrockReranker


def test_rerank_sends_inline_documents_and_returns_indexes_with_scores():
    client = boto3.client("bedrock-agent-runtime", region_name="eu-central-1")
    reranker = BedrockReranker(client)
    with Stubber(client) as stub:
        stub.add_response(
            "rerank",
            {"results": [{"index": 1, "relevanceScore": 0.92}, {"index": 0, "relevanceScore": 0.31}]},
            expected_params={
                "queries": [{"type": "TEXT", "textQuery": {"text": "mitosis"}}],
                "sources": [
                    {"type": "INLINE", "inlineDocumentSource": {"type": "TEXT", "textDocument": {"text": "a"}}},
                    {"type": "INLINE", "inlineDocumentSource": {"type": "TEXT", "textDocument": {"text": "b"}}},
                ],
                "rerankingConfiguration": {
                    "type": "BEDROCK_RERANKING_MODEL",
                    "bedrockRerankingConfiguration": {
                        "modelConfiguration": {
                            "modelArn": "arn:aws:bedrock:eu-central-1::foundation-model/cohere.rerank-v3-5:0"
                        },
                        "numberOfResults": 2,
                    },
                },
            },
        )

        assert reranker.rerank("mitosis", ["a", "b"], top_n=2) == [(1, 0.92), (0, 0.31)]
        stub.assert_no_pending_responses()


def test_top_n_never_exceeds_the_number_of_documents():
    client = boto3.client("bedrock-agent-runtime", region_name="eu-central-1")
    with Stubber(client) as stub:
        stub.add_response(
            "rerank",
            {"results": [{"index": 0, "relevanceScore": 0.5}]},
            expected_params={
                "queries": [{"type": "TEXT", "textQuery": {"text": "q"}}],
                "sources": [{"type": "INLINE", "inlineDocumentSource": {"type": "TEXT", "textDocument": {"text": "a"}}}],
                "rerankingConfiguration": {
                    "type": "BEDROCK_RERANKING_MODEL",
                    "bedrockRerankingConfiguration": {
                        "modelConfiguration": {
                            "modelArn": "arn:aws:bedrock:eu-central-1::foundation-model/cohere.rerank-v3-5:0"
                        },
                        "numberOfResults": 1,
                    },
                },
            },
        )

        assert BedrockReranker(client).rerank("q", ["a"], top_n=8) == [(0, 0.5)]
