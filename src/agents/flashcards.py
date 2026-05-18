from langchain_core.messages import HumanMessage, SystemMessage
from config import chat_model
from agents.state import AgentState


from messages import get_all_chunks


async def agente_flashcards(state: AgentState) -> AgentState:
    print("\n=== HISTORIAL EN AGENTE ===")
    for m in state["historial"]:
        print(f"{type(m).__name__}: {m.content[:100]}")
    print("===========================\n")

    contexto = get_all_chunks(state["document_id"])

    # CAMBIO 1: filtrar historial (solo últimos mensajes)

    mensajes = [
        SystemMessage(
            content="""Eres un experto en técnicas de estudio.

Genera flashcards útiles basadas en el contenido.

REGLAS IMPORTANTES:
- No repitas flashcards anteriores
- Si el usuario pide "otra", hazla diferente
- Usa SIEMPRE este formato:

**Pregunta:** ...
**Respuesta:** ...
---
"""
        )
    ]

    # CAMBIO 2: historial ANTES del contexto (mejor jerarquía mental)
    mensajes += state["historial"]

    # CAMBIO 3: contexto separado y más claro
    mensajes.append(SystemMessage(content=f"CONTEXTO DEL DOCUMENTO:\n{contexto}"))

    # CAMBIO 4: query limpia (sin mezclar con contexto)
    mensajes.append(HumanMessage(content=state["query"]))

    respuesta = await chat_model.ainvoke(mensajes)

    return {**state, "respuesta": respuesta.content}
