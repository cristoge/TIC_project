from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agents.simple_graph import simple_app, initial_simple_state
import json

router = APIRouter(prefix="/simple-chat", tags=["simple-chat"])


class Message(BaseModel):
    role: str
    content: str


class SimpleChatRequest(BaseModel):
    query: str
    historial: list[Message] = []


@router.post("/")
async def simple_chat(request: SimpleChatRequest):
    async def generate():
        historial = [msg.model_dump() for msg in request.historial]

        async for chunk in simple_app.astream(
            initial_simple_state(request.query, historial),
            stream_mode="messages",
            version="v2",
        ):
            if chunk["type"] == "messages":
                msg, metadata = chunk["data"]
                if msg.content:
                    yield json.dumps({"type": "token", "data": msg.content}) + "\n"

        yield json.dumps({"type": "end"}) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")
