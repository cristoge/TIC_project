from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agents.graph import app_graph, initial_state
from messages import guardar_mensajes, get_historial
from langchain_core.messages import HumanMessage, AIMessage
import json

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    query: str
    document_id: str


async def cargar_historial(document_id: str) -> list:
    mensajes = await get_historial(document_id)
    mensajes = mensajes[-5:]
    return [
        HumanMessage(content=m["contenido"])
        if m["rol"] == "user"
        else AIMessage(content=m["contenido"])
        for m in mensajes
    ]


@router.post("/")
async def chat(request: ChatRequest):
    async def generate():
        historial = await cargar_historial(request.document_id)
        contenido_completo = ""
        tipo_agente = ""
        async for chunk in app_graph.astream(
            initial_state(request.query, request.document_id, historial),
            stream_mode="messages",
            version="v2",
        ):
            if chunk["type"] == "messages":
                msg, metadata = chunk["data"]
                if msg.content and metadata["langgraph_node"] != "router":
                    contenido_completo += msg.content
                    yield json.dumps({"type": "token", "data": msg.content}) + "\n"
        await guardar_mensajes(
            request.document_id, request.query, contenido_completo, tipo_agente
        )
        yield json.dumps({"type": "end"}) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@router.get("/{document_id}/history")
async def get_chat_history(document_id: str):
    mensajes = await get_historial(document_id)
    return {"mensajes": mensajes}
