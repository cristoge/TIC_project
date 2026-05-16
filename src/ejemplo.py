import asyncio
from agents.graph import app_graph, initial_state

document_id = "a087f596-65b6-4d65-96b8-ca3dfc29695a"


async def main():
    async for chunk in app_graph.astream(
        initial_state("hazme 10 flashcards", document_id),
        stream_mode="messages",
        version="v2",
    ):
        if chunk["type"] == "messages":
            msg, metadata = chunk["data"]
            if msg.content:
                print(msg.content, end="", flush=True)


asyncio.run(main())
