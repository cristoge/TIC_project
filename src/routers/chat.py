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


@router.post("/")
async def chat(request: ChatRequest):
    async def generate():
        contenido_completo = ""
        tipo_agente = ""
        async for chunk in app_graph.astream(
            initial_state(request.query, request.document_id),
            stream_mode="messages",
            version="v2",
        ):
            if chunk["type"] == "messages":
                msg, metadata = chunk["data"]
                if msg.content and metadata["langgraph_node"] not in [
                    "router",
                    "cargar_historial",
                ]:
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
