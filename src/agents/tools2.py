from langchain_core.tools import tool
from langchain_core.messages import SystemMessage, HumanMessage
from config import chat_model
from retr import retriever as _retriever
from messages import get_all_chunks


def make_retriever_tool(document_id: str):
    @tool
    async def retriever(query: str) -> str:
        """Busca fragmentos relevantes en el documento. Úsala siempre antes de responder."""
        chunks = _retriever(query, document_id, similarity_threshold=0.0, match_count=5)
        return "\n".join(
            [f"Fragmento {i + 1}:\n{c['contenido']}" for i, c in enumerate(chunks)]
        )

    return retriever


@tool
async def resumen(document_id: str) -> str:
    """Genera un resumen completo y estructurado del documento.
    Úsala cuando el usuario pida un resumen."""
    contexto = get_all_chunks(document_id)

    borrador = await chat_model.ainvoke(
        [
            SystemMessage(
                content="""Eres un experto en síntesis de contenido académico.
Genera un resumen completo y estructurado del documento.
REGLAS:
- Responde en el mismo idioma del documento
- Identifica y explica los conceptos principales
- Mantén un orden lógico y coherente
- Organiza con títulos en MAYUSCULAS, sin markdown
- Máximo 400 palabras
- Sin asteriscos, sin guiones, sin markdown
- Comprensible para alguien que no ha leído el documento"""
            ),
            HumanMessage(content=f"Contexto:\n{contexto}"),
        ]
    )

    corregido = await chat_model.ainvoke(
        [
            SystemMessage(
                content="""Eres un corrector académico experto.
Revisa y mejora el siguiente resumen.
REGLAS:
- Responde en el mismo idioma del resumen
- Elimina repeticiones e información redundante
- Mejora la coherencia y fluidez del texto
- Lenguaje formal y académico
- Mantén todos los conceptos importantes
- No añadas información que no esté en el resumen original
- Sin asteriscos, sin guiones, sin markdown"""
            ),
            HumanMessage(content=borrador.content),
        ]
    )

    return corregido.content


@tool
async def flashcards(document_id: str) -> str:
    """Genera una flashcard de estudio basada en el documento.
    Úsala cuando el usuario quiera estudiar o pida flashcards."""
    contexto = get_all_chunks(document_id)

    respuesta = await chat_model.ainvoke(
        [
            SystemMessage(
                content="""Eres un experto en técnicas de estudio.
Genera flashcards útiles basadas en el contenido.
REGLAS:
- No repitas flashcards anteriores
- Si el usuario pide "otra", hazla diferente
- Responde SIEMPRE en el mismo idioma del usuario
- Pregunta: máximo 15 palabras, clara y concreta
- Respuesta: máximo 40 palabras, directa y sin rodeos
- Usa SIEMPRE este formato exacto:
PREGUNTA: ...
RESPUESTA: ...
- Sin asteriscos, sin guiones, sin markdown"""
            ),
            HumanMessage(content=f"Contexto del documento:\n{contexto}"),
        ]
    )

    return respuesta.content


@tool
async def explicacion(contexto: str, query: str) -> str:
    """Responde una pregunta libre usando el contexto recuperado del documento.
    Úsala después de retriever para responder preguntas o explicar conceptos."""
    respuesta = await chat_model.ainvoke(
        [
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
            ),
            HumanMessage(content=f"Contexto:\n{contexto}\n\nPregunta: {query}"),
        ]
    )

    return respuesta.content
