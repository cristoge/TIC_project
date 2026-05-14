from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from config import supabase

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectRequest(BaseModel):
    user_id: str
    nombre: str
    descripcion: str


@router.get("/{user_id}")
def get_projects(user_id: str):
    projects = supabase.table("projects").select("*").eq("user_id", user_id).execute()
    return {"projects": projects.data}


@router.post("/")
def create_project(request: ProjectRequest):
    project = (
        supabase.table("projects")
        .insert(
            {
                "user_id": request.user_id,
                "nombre": request.nombre,
                "descripcion": request.descripcion,
            }
        )
        .execute()
    )
    return {"project_id": project.data[0]["id"]}


@router.delete("/{project_id}")
def delete_project(project_id: str):
    supabase.table("projects").delete().eq("id", project_id).execute()
    return {"status": "deleted"}
