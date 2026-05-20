from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from agents.simple_state import SimpleState
from config import chat_model


async def agente_chat(state: SimpleState) -> SimpleState:
    mensajes = [
        SystemMessage(content="Eres un asistente útil. Responde de forma clara y concisa.")
    ]

    for msg in state["historial"]:
        if msg["role"] == "user":
            mensajes.append(HumanMessage(content=msg["content"]))
        else:
            mensajes.append(AIMessage(content=msg["content"]))

    mensajes.append(HumanMessage(content=state["query"]))

    respuesta = await chat_model.ainvoke(mensajes)
    return {**state, "respuesta": respuesta.content}


graph = StateGraph(SimpleState)
graph.add_node("chat", agente_chat)
graph.set_entry_point("chat")
graph.add_edge("chat", END)

simple_app = graph.compile()


def initial_simple_state(query: str, historial: list) -> dict:
    return {
        "query": query,
        "historial": historial,
        "respuesta": "",
    }
