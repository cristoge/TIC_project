import threading
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from config import supabase, supabase_admin
from ingesta import ingest_document, process_document


router = APIRouter(prefix="/documents", tags=["documents"])


class RenameRequest(BaseModel):
    nombre: str


@router.get("/user/{user_id}")
def get_user_documents(user_id: str):
    projects = supabase.table("projects").select("id").eq("user_id", user_id).execute()
    project_ids = [p["id"] for p in projects.data]
    if not project_ids:
        return {"documents": []}
    documents = supabase.table("documents").select("*").in_("project_id", project_ids).execute()
    return {"documents": documents.data}


@router.get("/{project_id}")
def get_documents(project_id: str):
    documents = (
        supabase.table("documents").select("*").eq("project_id", project_id).execute()
    )
    return {"documents": documents.data}


@router.post("/{project_id}")
async def upload_document(project_id: str, file: UploadFile = File(...)):
    nombre = file.filename or "documento.pdf"
    content = await file.read()

    storage_path = f"{project_id}/{nombre}"
    supabase_admin.storage.from_("documents").upload(
        path=storage_path,
        file=content,
        file_options={"content-type": "application/pdf"},
    )
    pdf_url = supabase_admin.storage.from_("documents").get_public_url(storage_path)

    doc = supabase.table("documents").insert({
        "project_id": project_id,
        "nombre": nombre,
        "processing_status": "processing",
    }).execute()
    document_id = doc.data[0]["id"]

    threading.Thread(target=process_document, args=(document_id, pdf_url), daemon=True).start()

    return {"document_id": document_id, "status": "processing"}


@router.patch("/{document_id}")
def rename_document(document_id: str, request: RenameRequest):
    supabase.table("documents").update({"nombre": request.nombre}).eq("id", document_id).execute()
    return {"status": "updated"}


@router.delete("/{document_id}")
def delete_document(document_id: str):
    supabase.table("documents").delete().eq("id", document_id).execute()
    return {"status": "deleted"}


@router.get("/{document_id}/status")
def get_status(document_id: str):
    document = (
        supabase.table("documents")
        .select("processing_status")
        .eq("id", document_id)
        .execute()
    )
    if not document.data:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return {"status": document.data[0]["processing_status"]}
