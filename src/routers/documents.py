from fastapi import APIRouter, HTTPException, UploadFile, File
from config import supabase
from ingesta import ingest_document


router = APIRouter(prefix="/documents", tags=["documents"])


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


#
# @router.post("/{project_id}")
# def upload_document(project_id: str, file: UploadFile = File(...)):
#


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
