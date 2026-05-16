from langchain_core.messages import HumanMessage, SystemMessage
from config import chat_model
from agents.state import AgentState


from messages import get_all_chunks


async def agente_flashcards(state: AgentState) -> AgentState:
    contexto = get_all_chunks(state["document_id"])
    mensajes = [
        SystemMessage(
            content="""Eres un experto en técnicas de estudio.
Genera flashcards para repasar el contenido del documento.
SIEMPRE usa este formato exacto sin excepción, para CADA flashcard:
**Pregunta:** ...
**Respuesta:** ...
---
No uses ningún otro formato. No uses listas numeradas. Solo el formato de arriba."""
        )
    ]
    # mensajes += state["historial"]  # comentado para implementar después
    mensajes.append(
        HumanMessage(content=f"Contexto:\n{contexto}\n\nSolicitud: {state['query']}")
    )
    respuesta = await chat_model.ainvoke(mensajes)
    return {**state, "respuesta": respuesta.content}
