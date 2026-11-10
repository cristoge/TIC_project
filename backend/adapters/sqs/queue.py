import json


class SqsJobQueue:
    """Queues study-artifact generation jobs for entrypoints/generation/handler.py."""

    def __init__(self, client, queue_url: str):
        self.client = client
        self.queue_url = queue_url

    def enqueue(self, kind: str, generation_id: str) -> None:
        self.client.send_message(QueueUrl=self.queue_url, MessageBody=json.dumps({"kind": kind, "id": generation_id}))
