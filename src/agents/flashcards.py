from langchain_core.messages import HumanMessage, SystemMessage
from config import chat_model
from agents.state import AgentState


from messages import get_all_chunks


async def agente_flashcards(state: AgentState) -> AgentState:
    # DEBUG - ver historial
    print("\n=== HISTORIAL EN AGENTE ===")
    for m in state["historial"]:
        print(f"{type(m).__name__}: {m.content[:100]}")
    print("===========================\n")

    contexto = get_all_chunks(state["document_id"])
    mensajes = [
        SystemMessage(
            content="""Eres un experto en técnicas de estudio.
Genera una flashcard para repasar el contenido del documento.
SIEMPRE usa este formato exacto sin excepción, para la flashcard:
**Pregunta:** ...
**Respuesta:** ...
---
No uses ningún otro formato. No uses listas numeradas. Solo el formato de arriba."""
        )
    ]
    mensajes += state["historial"]
    mensajes.append(
        HumanMessage(content=f"Contexto:\n{contexto}\n\nSolicitud: {state['query']}")
    )
    respuesta = await chat_model.ainvoke(mensajes)
    return {**state, "respuesta": respuesta.content}
