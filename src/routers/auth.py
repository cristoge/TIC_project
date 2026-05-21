from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from config import supabase

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UpdateProfileRequest(BaseModel):
    nombre: str


def get_user_id(authorization: str = Header(...)) -> str:
    try:
        token = authorization.split(" ")[1]
        response = supabase.auth.get_user(token)
        return response.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")


@router.post("/register")
def register(request: RegisterRequest):
    try:
        response = supabase.auth.sign_up(
            {
                "email": request.email,
                "password": request.password,
            }
        )
        return {"user_id": response.user.id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login")
def login(request: LoginRequest):
    try:
        response = supabase.auth.sign_in_with_password(
            {"email": request.email, "password": request.password}
        )
        return {
            "user_id": response.user.id,
            "access_token": response.session.access_token,
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")


@router.get("/me")
def get_me(user_id: str = Depends(get_user_id)):
    try:
        response = supabase.table("usuarios").select("nombre, email").eq("id", user_id).single().execute()
        return response.data
    except Exception:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")


@router.patch("/me")
def update_me(request: UpdateProfileRequest, user_id: str = Depends(get_user_id)):
    try:
        supabase.table("usuarios").update({"nombre": request.nombre}).eq("id", user_id).execute()
        return {"ok": True}
    except Exception:
        raise HTTPException(status_code=400, detail="Error al actualizar")

