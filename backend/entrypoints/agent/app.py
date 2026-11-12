"""Chat agent server: `uv run python -m entrypoints.agent.app` serves POST /invocations on :8080.

COGNITO_ISSUER and COGNITO_CLIENT_ID make it verify tokens itself. It listens on
127.0.0.1 unless AGENT_HOST says otherwise (0.0.0.0 lets a phone or simulator reach it).
"""

import json
import os
from collections.abc import AsyncIterator
from functools import cache

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

from entrypoints.agent.handler import identify, run_chat

app = FastAPI(title="Study chat agent")


@cache
def _chat_and_verifier():
    from entrypoints.local import local_chat, local_verifier

    return local_chat(), local_verifier()


@app.get("/ping")
def ping():
    return {"status": "Healthy"}


@app.post("/invocations")
async def invoke(request: Request):
    try:
        payload = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
    chat, verifier = _chat_and_verifier()
    user = identify(request.headers, verifier)
    return StreamingResponse(_server_sent_events(run_chat(chat, user, payload)), media_type="text/event-stream")


async def _server_sent_events(events: AsyncIterator[dict]) -> AsyncIterator[str]:
    async for event in events:
        yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.environ.get("AGENT_HOST", "127.0.0.1"), port=8080, log_level="warning")
