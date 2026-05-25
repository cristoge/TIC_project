from langchain_core.messages import HumanMessage, SystemMessage
from config import chat_model
from agents.state import AgentState


async def agente_explicacion(state: AgentState) -> AgentState:
    mensajes = [
        SystemMessage(
            content="""Eres un asistente experto en el contenido del documento.

REGLAS:
- Responde SIEMPRE en el mismo idioma que el usuario
- Máximo 80 palabras, sé conciso y directo
- Sin introducciones como "Claro", "Por supuesto", "¡Hola!" — ve al grano
- Usa el contexto del documento Y el historial de conversación
- Si no sabes la respuesta, dilo claramente en una frase
- Para listas usa máximo 3-4 puntos cortos
- Formato simple, sin markdown innecesario (es una app mobile)"""
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
