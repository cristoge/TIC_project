from langchain_core.messages import HumanMessage, SystemMessage
from config import chat_model
from agents.state import AgentState


def agente_explicacion(state: AgentState) -> AgentState:
    respuesta = chat_model.invoke(
        [
            SystemMessage(
                content="Responde la pregunta del usuario basándote únicamente en el contexto proporcionado."
            ),
            HumanMessage(
                content=f"Contexto:\n{state['contexto']}\n\nPregunta: {state['query']}"
            ),
        ]
    )
    return {**state, "respuesta": respuesta.content}
