from langchain_core.messages import HumanMessage, SystemMessage

from retr import retriever
from config import chat_model


def rag_simple(query: str, document_id: str):
    chunks = retriever(query, document_id, similarity_threshold=0.0, match_count=5)
    contexto = "\n\n".join([c["contenido"] for c in chunks])

    respuesta = chat_model.invoke(
        [
            SystemMessage(
                content="Eres un asistente que responde preguntas basándose únicamente en el contexto proporcionado."
            ),
            HumanMessage(content=f"Contexto:\n{contexto}\n\nPregunta: {query}"),
        ]
    )

    return respuesta.content


# Prueba
print(
    rag_simple(
        "De que trata el documento",
        document_id="",
    )
)
