from langchain_core.messages import HumanMessage, SystemMessage
from config import chat_model, supabase
from agents.state import AgentState


def agente_test(state: AgentState) -> AgentState:
    chunks = (
        supabase.table("document_chunks")
        .select("contenido")
        .eq("document_id", state["document_id"])
        .order("numero_chunk")
        .execute()
    )
    contexto = "\n".join(
        [f"Fragmento {i + 1}:\n{c['contenido']}" for i, c in enumerate(chunks.data)]
    )

    respuesta = chat_model.invoke(
        [
            SystemMessage(
                content="""Genera 5 preguntas de test con 4 opciones cada una basándote en el contexto.
Devuelve SOLO un JSON con este formato sin ningún texto adicional ni backticks:
{
  "preguntas": [
    {
      "pregunta": "texto",
      "opciones": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "respuesta_correcta": "A"
    }
  ]
}"""
            ),
            HumanMessage(content=f"Contexto:\n{contexto}"),
        ]
    )
    return {**state, "respuesta": respuesta.content}


def agente_corrector_test(state: AgentState) -> AgentState:
    # Extraer el JSON del test y las respuestas del usuario de la query
    respuesta = chat_model.invoke(
        [
            SystemMessage(
                content="""Eres un corrector de test.
Recibirás un JSON con las preguntas y respuestas correctas, y las respuestas del usuario.
Para cada pregunta:
- Indica SOLO si la respuesta del usuario es correcta ✅ o incorrecta ❌
- Si es incorrecta explica brevemente por qué
- NO muestres las respuestas correctas de preguntas que no respondió el usuario
Al final da la puntuación total sobre 5."""
            ),
            HumanMessage(content=state["query"]),
        ]
    )
    return {**state, "respuesta": respuesta.content}
