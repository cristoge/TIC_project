from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from config import supabase

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


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

