from langchain_core.messages import HumanMessage, SystemMessage
from config import chat_model
from agents.state import AgentState


from messages import get_all_chunks


async def agente_flashcards(state: AgentState) -> AgentState:
    contexto = get_all_chunks(state["document_id"])
    mensajes = [
        SystemMessage(
            content="""Eres un experto en técnicas de estudio.
Genera flashcards útiles basadas en el contenido.

REGLAS:
- No repitas flashcards anteriores
- Si el usuario pide "otra", hazla diferente
- Responde SIEMPRE en el mismo idioma del usuario
- Pregunta: máximo 15 palabras, clara y concreta
- Respuesta: máximo 40 palabras, directa y sin rodeos
- Usa SIEMPRE este formato exacto:
PREGUNTA: ...
RESPUESTA: ...
- Sin asteriscos, sin guiones, sin markdown"""
        )
    ]
    mensajes += state["historial"]
    mensajes.append(
        HumanMessage(
            content=f"Contexto del documento:\n{contexto}\n\nPetición: {state['query']}"
        )
    )
    respuesta = await chat_model.ainvoke(mensajes)
    return {**state, "respuesta": respuesta.content}
