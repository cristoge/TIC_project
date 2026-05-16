from langchain_core.messages import HumanMessage, SystemMessage
from config import chat_model
from agents.state import AgentState


def agente_explicacion(state: AgentState) -> AgentState:
    respuesta = chat_model.invoke(
        [
            SystemMessage(
                content="""Eres un asistente experto en el contenido del documento.
Responde la pregunta del usuario de forma clara, precisa y bien estructurada.
Basa tu respuesta ÚNICAMENTE en el contexto proporcionado.
Si la información no está en el contexto, indícalo claramente en lugar de inventarte una respuesta."""
            ),
            HumanMessage(
                content=f"Contexto:\n{state['contexto']}\n\nPregunta: {state['query']}"
            ),
        ]
    )
    return {**state, "respuesta": respuesta.content}
