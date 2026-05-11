from typing import TypedDict


class AgentState(TypedDict):
    query: str
    document_id: str
    tipo_agente: str
    contexto: str
    respuesta: str
    historial: list
