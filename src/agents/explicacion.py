from langchain_core.messages import HumanMessage, SystemMessage
from config import chat_model
from agents.state import AgentState


async def agente_explicacion(state: AgentState) -> AgentState:
    mensajes = [
        SystemMessage(
            content="""Eres un asistente experto en el contenido del documento.
Responde la pregunta del usuario de forma clara y precisa.
Puedes basarte en el contexto del documento Y en el historial de la conversación.
Si la información está en el historial úsala, si está en el contexto úsala también."""
        )
    ]
    mensajes += state["historial"]
    mensajes.append(
        HumanMessage(
            content=f"Contexto:\n{state['contexto']}\n\nPregunta: {state['query']}"
        )
    )

    respuesta = await chat_model.ainvoke(mensajes)
    return {**state, "respuesta": respuesta.content}
