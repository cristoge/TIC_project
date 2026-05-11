from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from config import supabase, embedding_model


def ingest_document(project_id: str, pdf_path: str, nombre_original: str):
    doc = (
        supabase.table("documents")
        .insert(
            {
                "project_id": project_id,
                "nombre_original": nombre_original,
                "processing_status": "processing",
            }
        )
        .execute()
    )
    document_id = doc.data[0]["id"]

    try:
        loader = PyPDFLoader(pdf_path)
        docs = loader.load()
        splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
        chunks = splitter.split_documents(docs)
        vectors = embedding_model.embed_documents([c.page_content for c in chunks])

        for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
            chunk_row = (
                supabase.table("document_chunks")
                .insert(
                    {
                        "document_id": document_id,
                        "contenido": chunk.page_content,
                        "numero_chunk": i,
                        "tokens_count": len(chunk.page_content.split()),
                    }
                )
                .execute()
            )
            chunk_id = chunk_row.data[0]["id"]

            supabase.table("embeddings").insert(
                {
                    "chunk_id": chunk_id,
                    "vector": vector,
                    "modelo_embedding": "nomic-embed-text-v2-moe",
                }
            ).execute()

        supabase.table("documents").update({"processing_status": "completed"}).eq(
            "id", document_id
        ).execute()

        print(f"Ingesta completada: {len(chunks)} chunks procesados")

    except Exception as e:
        supabase.table("documents").update(
            {"processing_status": "failed", "error_mensaje": str(e)}
        ).eq("id", document_id).execute()
        raise


ingest_document(
    project_id="",
    pdf_path="../docs/ejemplo2.pdf",
    nombre_original="documento.pdf",
)
