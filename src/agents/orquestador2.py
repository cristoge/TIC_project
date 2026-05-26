from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from config import chat_model
from messages import get_historial
from agents.state import AgentState
from agents.tools2 import make_retriever_tool, resumen, flashcards, explicacion


def make_orquestador(document_id: str):
    retriever_tool = make_retriever_tool(document_id)
    tools = [retriever_tool, resumen, flashcards, explicacion]
    llm_con_tools = chat_model.bind_tools(tools)

    async def orquestador(state: AgentState):
        system = SystemMessage(
            content=f"""Eres un asistente experto en el contenido de documentos de estudio.
Tienes estas tools disponibles:
- retriever: busca fragmentos relevantes del documento por query. Úsala SIEMPRE antes de llamar a explicacion.
- resumen: genera un resumen completo del documento. No necesita contexto previo.
- flashcards: genera tarjetas de estudio del documento. No necesita contexto previo.
- explicacion: responde preguntas usando el contexto recuperado por retriever.

Instrucciones:
1. Para resumen o flashcards: llama directamente a la tool, sin retriever.
2. Para cualquier pregunta libre: llama primero a retriever, luego a explicacion con el resultado.
3. Cuando tengas el resultado de la tool, responde directamente al usuario sin llamar más tools.

document_id activo: {document_id}"""
        )

        messages = [system] + state["messages"]
        response = await llm_con_tools.ainvoke(messages)
        return {"messages": [response]}

    return orquestador, tools


def should_continue(state: AgentState):
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"
    return END


def build_graph(document_id: str):
    orquestador, tools = make_orquestador(document_id)
    tool_node = ToolNode(tools)

    graph = StateGraph(AgentState)
    graph.add_node("orquestador", orquestador)
    graph.add_node("tools", tool_node)

    graph.set_entry_point("orquestador")
    graph.add_conditional_edges(
        "orquestador",
        should_continue,
        {
            "tools": "tools",
            END: END,
        },
    )
    graph.add_edge("tools", "orquestador")

    return graph.compile()


async def build_initial_state(query: str, document_id: str) -> dict:
    mensajes_db = await get_historial(document_id)
    historial = [
        HumanMessage(content=m["contenido"])
        if m["rol"] == "user"
        else AIMessage(content=m["contenido"])
        for m in mensajes_db
    ]
    return {
        "query": query,
        "document_id": document_id,
        "messages": historial + [HumanMessage(content=query)],
    }
