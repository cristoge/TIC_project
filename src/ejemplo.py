import asyncio
from agents.graph import app_graph, initial_state
from langchain_core.messages import HumanMessage, AIMessage

document_id = "a087f596-65b6-4d65-96b8-ca3dfc29695a"


async def chat(query: str, historial: list = []):
    contenido_completo = ""
    async for chunk in app_graph.astream(
        initial_state(query, document_id, historial),
        stream_mode="messages",
        version="v2",
    ):
        if chunk["type"] == "messages":
            msg, metadata = chunk["data"]
            if msg.content and metadata["langgraph_node"] != "router":
                contenido_completo += msg.content
                print(msg.content, end="", flush=True)
    print()
    return contenido_completo


async def main():
    # Mensaje 1 - pide flashcard
    print("\n=== MENSAJE 1 ===\n")
    respuesta1 = await chat("dame una flashcard sobre el tema principal")

    # Mensaje 2 - pide explicacion
    print("\n=== MENSAJE 2 ===\n")
    historial1 = [
        HumanMessage(content="dame una flashcard sobre el tema principal"),
        AIMessage(content=respuesta1),
    ]
    respuesta2 = await chat("explícame más sobre eso", historial1)

    # Mensaje 3 - pide la flashcard anterior
    print("\n=== MENSAJE 3 ===\n")
    historial2 = [
        HumanMessage(content="dame una flashcard sobre el tema principal"),
        AIMessage(content=respuesta1),
        HumanMessage(content="explícame más sobre eso"),
        AIMessage(content=respuesta2),
    ]
    await chat("puedes devolverme la flashcard anterior", historial2)


asyncio.run(main())
