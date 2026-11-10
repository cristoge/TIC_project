import json

from scripts.export_openapi import main


def test_writes_the_api_schema_without_any_backing_service(tmp_path):
    out = tmp_path / "openapi.json"

    assert main([str(out)]) == 0

    schema = json.loads(out.read_text())
    assert schema["info"]["title"] == "Study RAG API"
    assert "/projects" in schema["paths"]
    assert "/conversations/{conversation_id}/messages" in schema["paths"]
    assert "MessageOut" in schema["components"]["schemas"]
