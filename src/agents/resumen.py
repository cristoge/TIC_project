from langchain_core.messages import HumanMessage, SystemMessage
from config import chat_model
from agents.state import AgentState


def agente_resumen(state: AgentState) -> AgentState:
    respuesta = chat_model.invoke(
        [
            SystemMessage(
                content="Genera un resumen claro y estructurado del siguiente contexto."
            ),
            HumanMessage(content=f"Contexto:\n{state['contexto']}"),
        ]
    )
    return {**state, "respuesta": respuesta.content}


def agente_corrector(state: AgentState) -> AgentState:
    respuesta = chat_model.invoke(
        [
            SystemMessage(
                content="Eres un corrector. Refina el siguiente resumen haciéndolo más formal, conciso y bien estructurado."
            ),
            HumanMessage(content=state["respuesta"]),
        ]
    )
    return {**state, "respuesta": respuesta.content}
