from typing import Literal
from langchain_core.messages import HumanMessage, SystemMessage
from config import chat_model
from agents.state import AgentState


async def router(state: AgentState) -> AgentState:
    mensajes = [
        SystemMessage(
            content="""Eres un router que clasifica la intención del usuario.
Según la pregunta devuelve SOLO una de estas palabras:
- resumen: si el usuario quiere un resumen del documento
- flashcards: si el usuario quiere flashcards para estudiar
- explicacion: si el usuario quiere una explicación o tiene una pregunta libre
Devuelve SOLO la palabra, sin explicación."""
        )
    ]
    # mensajes += state["historial"]  # comentado para implementar después
    mensajes.append(HumanMessage(content=state["query"]))
    respuesta = await chat_model.ainvoke(mensajes)
    tipo = respuesta.content.strip().lower()
    if tipo not in ["resumen", "flashcards", "explicacion"]:
        tipo = "explicacion"
    return {**state, "tipo_agente": tipo}


def decidir_agente(
    state: AgentState,
) -> Literal["resumen", "flashcards", "explicacion"]:
    return state["tipo_agente"]
