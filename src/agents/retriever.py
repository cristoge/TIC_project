from retr import retriever
from agents.state import AgentState


async def nodo_retriever(state: AgentState) -> AgentState:
    chunks = retriever(
        state["query"], state["document_id"], similarity_threshold=0.0, match_count=5
    )
    contexto = "\n".join(
        [f"Fragmento {i + 1}:\n{c['contenido']}" for i, c in enumerate(chunks)]
    )
    return {**state, "contexto": contexto}
