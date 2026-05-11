from config import supabase, embedding_model


def retriever(
    query: str,
    document_id: str,
    similarity_threshold: float = 0.5,
    match_count: int = 5,
):
    query_vector = embedding_model.embed_query(query)

    # 2. Llamar a la función RPC de Supabase
    resultados = supabase.rpc(
        "match_embeddings",
        {
            "query_embedding": query_vector,
            "document_id_param": document_id,
            "similarity_threshold": similarity_threshold,
            "match_count": match_count,
        },
    ).execute()

    return resultados.data
