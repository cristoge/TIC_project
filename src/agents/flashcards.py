from langchain_core.messages import HumanMessage, SystemMessage
from config import chat_model
from agents.state import AgentState


def agente_flashcards(state: AgentState) -> AgentState:
    respuesta = chat_model.invoke(
        [
            SystemMessage(
                content="Genera 5 flashcards en formato Pregunta/Respuesta basándote en el contexto."
            ),
            HumanMessage(content=f"Contexto:\n{state['contexto']}"),
        ]
    )
    return {**state, "respuesta": respuesta.content}
