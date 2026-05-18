import asyncio
from agents.graph import app_graph, initial_state
from messages import guardar_mensajes

document_id = "a087f596-65b6-4d65-96b8-ca3dfc29695a"


async def chat(query: str):
    contenido_completo = ""
    async for chunk in app_graph.astream(
        initial_state(query, document_id),
        stream_mode="messages",
        version="v2",
    ):
        if chunk["type"] == "messages":
            msg, metadata = chunk["data"]
            if msg.content and metadata["langgraph_node"] not in [
                "router",
                "cargar_historial",
            ]:
                contenido_completo += msg.content
                print(msg.content, end="", flush=True)
    print()
    await guardar_mensajes(document_id, query, contenido_completo)
    return contenido_completo


async def main():
    print("\n=== MENSAJE 1 ===\n")
    await chat("dame una flashcard sobre el tema principal")

    print("\n=== MENSAJE 2 ===\n")
    await chat("explícame más sobre eso")

    print("\n=== MENSAJE 3 ===\n")
    await chat("puedes devolverme la flashcard anterior")


asyncio.run(main())
