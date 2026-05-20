import asyncio
from agents.simple_graph import simple_app, initial_simple_state

historial = []


async def chat(query: str):
    state = initial_simple_state(query, historial)
    result = await simple_app.ainvoke(state)
    respuesta = result["respuesta"]

    historial.append({"role": "user", "content": query})
    historial.append({"role": "assistant", "content": respuesta})

    print(f"\nAsistente: {respuesta}\n")
    return respuesta


async def main():
    print("Chat iniciado. Escribe 'salir' para terminar.\n")
    while True:
        query = input("Tú: ").strip()
        if query.lower() == "salir":
            break
        if query:
            await chat(query)


asyncio.run(main())
