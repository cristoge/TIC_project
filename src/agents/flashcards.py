from langchain_core.messages import HumanMessage, SystemMessage
from config import chat_model
from agents.state import AgentState


def agente_flashcards(state: AgentState) -> AgentState:
    respuesta = chat_model.invoke(
        [
            SystemMessage(
                content="""Eres un experto en técnicas de estudio.
Genera 10 flashcards para repasar el contenido del documento.
Cada flashcard debe tener:
- Una pregunta concisa y clara
- Una respuesta breve y directa, máximo 2 líneas
Cubre los conceptos más importantes del documento.
Formato:
**Pregunta:** ...
**Respuesta:** ...
---"""
            ),
            HumanMessage(content=f"Contexto:\n{state['contexto']}"),
        ]
    )
    return {**state, "respuesta": respuesta.content}
