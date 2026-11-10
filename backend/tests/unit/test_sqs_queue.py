import json

import boto3
from botocore.stub import Stubber

from adapters.sqs.queue import SqsJobQueue

QUEUE_URL = "https://sqs.eu-central-1.amazonaws.com/123456789012/generation"


def test_enqueue_sends_the_job_as_json():
    client = boto3.client("sqs", region_name="eu-central-1")
    with Stubber(client) as stub:
        stub.add_response(
            "send_message",
            {"MessageId": "m1"},
            expected_params={"QueueUrl": QUEUE_URL, "MessageBody": json.dumps({"kind": "quiz", "id": "q1"})},
        )

        SqsJobQueue(client, QUEUE_URL).enqueue("quiz", "q1")
        stub.assert_no_pending_responses()
