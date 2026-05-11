from langchain_core.messages import HumanMessage, SystemMessage
from config import chat_model
from agents.state import AgentState


def agente_test(state: AgentState) -> AgentState:
    respuesta = chat_model.invoke(
        [
            SystemMessage(
                content="Genera 5 preguntas de test con 4 opciones cada una basándote en el contexto. Indica la respuesta correcta."
            ),
            HumanMessage(content=f"Contexto:\n{state['contexto']}"),
        ]
    )
    return {**state, "respuesta": respuesta.content}
