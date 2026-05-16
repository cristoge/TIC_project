from langchain_core.messages import HumanMessage, SystemMessage
from config import chat_model
from agents.state import AgentState
from messages import get_all_chunks


async def agente_resumen(state: AgentState) -> AgentState:
    contexto = get_all_chunks(state["document_id"])
    respuesta = await chat_model.ainvoke(
        [
            SystemMessage(
                content="""Eres un experto en síntesis de contenido académico.
Genera un resumen completo y estructurado del documento.
El resumen debe:
- Identificar y explicar los conceptos principales
- Mantener un orden lógico y coherente
- Usar títulos y subtítulos para organizar la información
- Ser comprensible para alguien que no ha leído el documento"""
            ),
            HumanMessage(content=f"Contexto:\n{contexto}"),
        ]
    )
    return {**state, "respuesta": respuesta.content}


async def agente_corrector(state: AgentState) -> AgentState:
    respuesta = await chat_model.ainvoke(
        [
            SystemMessage(
                content="""Eres un corrector académico experto.
Revisa y mejora el siguiente resumen:
- Elimina repeticiones e información redundante
- Mejora la coherencia y fluidez del texto
- Asegúrate de que el lenguaje sea formal y académico
- Mantén todos los conceptos importantes
- No añadas información que no esté en el resumen original"""
            ),
            HumanMessage(content=state["respuesta"]),
        ]
    )
    return {**state, "respuesta": respuesta.content}
