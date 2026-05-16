from config import supabase


async def guardar_mensajes(
    document_id: str, query: str, respuesta: str, tipo_agente: str = ""
):
    supabase.table("chat_messages").insert(
        {
            "document_id": document_id,
            "rol": "user",
            "contenido": query,
            "tipo_solicitud": tipo_agente,
        }
    ).execute()
    supabase.table("chat_messages").insert(
        {
            "document_id": document_id,
            "rol": "assistant",
            "contenido": respuesta,
            "tipo_solicitud": tipo_agente,
        }
    ).execute()


async def get_historial(document_id: str) -> list:
    mensajes = (
        supabase.table("chat_messages")
        .select("*")
        .eq("document_id", document_id)
        .in_("rol", ["user", "assistant"])
        .order("created_at")
        .execute()
    )
    return mensajes.data


def get_all_chunks(document_id: str) -> str:
    chunks = (
        supabase.table("document_chunks")
        .select("contenido")
        .eq("document_id", document_id)
        .order("numero_chunk")
        .execute()
    )
    return "\n".join(
        [f"Fragmento {i + 1}:\n{c['contenido']}" for i, c in enumerate(chunks.data)]
    )
