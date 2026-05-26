from typing import TypedDict, Annotated
import operator


class AgentState(TypedDict):
    query: str
    document_id: str
    messages: Annotated[list, operator.add]  # acumula el loop orquestador ↔ tools
