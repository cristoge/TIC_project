from langgraph.graph import StateGraph, END
from agents.state import AgentState
from agents.router import router, decidir_agente
from agents.retriever import nodo_retriever
from agents.resumen import agente_resumen, agente_corrector
from agents.flashcards import agente_flashcards
from agents.explicacion import agente_explicacion
from agents.memory_loader import cargar_historial_nodo

graph = StateGraph(AgentState)
graph.add_node("cargar_historial", cargar_historial_nodo)
graph.add_node("router", router)
graph.add_node("retriever", nodo_retriever)
graph.add_node("resumen", agente_resumen)
graph.add_node("corrector", agente_corrector)
graph.add_node("flashcards", agente_flashcards)
graph.add_node("explicacion", agente_explicacion)

graph.set_entry_point("cargar_historial")
graph.add_edge("cargar_historial", "router")

graph.add_conditional_edges(
    "router",
    decidir_agente,
    {
        "resumen": "retriever",
        "flashcards": "retriever",
        "explicacion": "retriever",
    },
)
graph.add_conditional_edges(
    "retriever",
    decidir_agente,
    {
        "resumen": "resumen",
        "flashcards": "flashcards",
        "explicacion": "explicacion",
    },
)
graph.add_edge("resumen", "corrector")
graph.add_edge("corrector", END)
graph.add_edge("flashcards", END)
graph.add_edge("explicacion", END)

app_graph = graph.compile()


async def run_agent(query: str, document_id: str) -> str:
    resultado = await app_graph.ainvoke(initial_state(query, document_id))
    return resultado["respuesta"]


def run_agent_sync(query: str, document_id: str) -> str:
    resultado = app_graph.invoke(initial_state(query, document_id))
    return resultado["respuesta"]


def initial_state(query: str, document_id: str) -> dict:
    return {
        "query": query,
        "document_id": document_id,
        "tipo_agente": "",
        "contexto": "",
        "respuesta": "",
        "historial": [],
        "test_data": {},
    }
