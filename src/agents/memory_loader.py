from langchain_core.messages import AIMessage, HumanMessage
from agents.state import AgentState
from messages import get_historial


async def cargar_historial_nodo(state: AgentState):
    mensajes = await get_historial(state["document_id"])

    historial = [
        HumanMessage(content=m["contenido"])
        if m["rol"] == "user"
        else AIMessage(content=m["contenido"])
        for m in mensajes
    ]

    return {**state, "historial": historial}
