import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agents.orquestador2 import build_graph, build_initial_state
from messages import get_all_historial, get_historial, guardar_mensajes


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    query: str
    document_id: str


@router.post("/")
async def chat(request: ChatRequest):
    def extract_text(content) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "".join(
                block.get("text", "") if isinstance(block, dict) else ""
                for block in content
            )
        return ""

    async def generate():
        contenido_completo = ""
        app = build_graph(request.document_id)
        state = await build_initial_state(request.query, request.document_id)

        async for chunk in app.astream(
            state,
            stream_mode="messages",
            version="v2",
        ):
            if chunk["type"] == "messages":
                msg, metadata = chunk["data"]
                if (
                    msg.content
                    and metadata["langgraph_node"] == "orquestador"
                    and not getattr(msg, "tool_calls", None)
                ):
                    texto = extract_text(msg.content)
                    if texto:
                        contenido_completo += texto
                        yield json.dumps({"type": "token", "data": texto}) + "\n"

        await guardar_mensajes(request.document_id, request.query, contenido_completo)
        yield json.dumps({"type": "end"}) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@router.get("/{document_id}/history")
async def get_chat_history(document_id: str):
    mensajes = await get_historial(document_id)
    return {"mensajes": mensajes}


@router.get("/{document_id}/messages")
async def get_all_messages(document_id: str):
    mensajes = await get_all_historial(document_id)
    return {"mensajes": mensajes}
