import io
import json

import boto3
from botocore.response import StreamingBody
from botocore.stub import Stubber

from adapters.bedrock.embeddings import TitanEmbedder


def _body(payload):
    data = json.dumps(payload).encode()
    return StreamingBody(io.BytesIO(data), len(data))


def test_embed_sends_the_titan_v2_request_and_returns_the_vector():
    client = boto3.client("bedrock-runtime", region_name="eu-central-1")
    embedder = TitanEmbedder(client, max_workers=1)
    with Stubber(client) as stub:
        stub.add_response(
            "invoke_model",
            {"body": _body({"embedding": [0.1, 0.2], "inputTextTokenCount": 3}), "contentType": "application/json"},
            expected_params={
                "modelId": "amazon.titan-embed-text-v2:0",
                "contentType": "application/json",
                "accept": "application/json",
                "body": json.dumps({"inputText": "Mitosis", "dimensions": 512, "normalize": True}),
            },
        )

        assert embedder.embed(["Mitosis"]) == [[0.1, 0.2]]
        stub.assert_no_pending_responses()


class EchoClient:
    """Returns an embedding derived from the input text, so order can be checked."""

    def invoke_model(self, **kwargs):
        text = json.loads(kwargs["body"])["inputText"]
        return {"body": _body({"embedding": [float(len(text))]})}


def test_embed_keeps_the_input_order_when_running_in_parallel():
    texts = ["a" * n for n in range(1, 30)]

    vectors = TitanEmbedder(EchoClient(), max_workers=8).embed(texts)

    assert vectors == [[float(n)] for n in range(1, 30)]


def test_embed_of_nothing_makes_no_calls():
    assert TitanEmbedder(EchoClient()).embed([]) == []
