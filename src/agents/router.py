from typing import Literal
from langchain_core.messages import HumanMessage, SystemMessage
from config import chat_model
from agents.state import AgentState


def router(state: AgentState) -> AgentState:
    respuesta = chat_model.invoke(
        [
            SystemMessage(
                content="""Eres un router que clasifica la intención del usuario.
Según la pregunta devuelve SOLO una de estas palabras:
- resumen: si el usuario quiere un resumen del documento
- test: si el usuario quiere preguntas de test
- flashcards: si el usuario quiere flashcards para estudiar
- explicacion: si el usuario quiere una explicación o tiene una pregunta libre
- corregir_test: si el usuario está enviando respuestas a un test para que las corrijas

Devuelve SOLO la palabra, sin explicación."""
            ),
            HumanMessage(content=state["query"]),
        ]
    )
    tipo = respuesta.content.strip().lower()
    if tipo not in ["resumen", "test", "flashcards", "explicacion", "corregir_test"]:
        tipo = "explicacion"
    return {**state, "tipo_agente": tipo}


def decidir_agente(
    state: AgentState,
) -> Literal["resumen", "test", "flashcards", "explicacion", "corregir_test"]:
    return state["tipo_agente"]
