"""
FastAPI router for user-controlled settings.
Manages user API keys for OpenAI, Anthropic, and Google Gemini.
Provides a central helper function to resolve active API keys dynamically.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from app.api.routes.auth import get_current_user
from app.db.supabase_client import supabase_admin
from app.core.config import settings

router = APIRouter(prefix="/settings", tags=["settings"])


class UserApiKeyInput(BaseModel):
    provider: str = Field(..., description="API provider: 'openai', 'anthropic', or 'google'")
    api_key: str = Field(..., description="The API Key value")


class UserApiKeyStatus(BaseModel):
    provider: str
    has_key: bool
    masked_key: str


def mask_api_key(key: str) -> str:
    """
    Return a masked representation of the API key for secure displays.
    """
    if len(key) <= 8:
        return "****"
    return f"{key[:6]}...{key[-4:]}"


def resolve_api_key(user_id: str, provider: str) -> str:
    """
    Look up the user's specific API key from the user_api_keys table.
    Falls back to environment settings if no user-level key exists.
    If no key can be resolved, raises an HTTPException (400 Bad Request).
    """
    try:
        response = supabase_admin.table("user_api_keys") \
            .select("api_key") \
            .eq("user_id", str(user_id)) \
            .eq("provider", provider) \
            .execute()
        if response.data and response.data[0].get("api_key"):
            return response.data[0]["api_key"].strip()
    except Exception as e:
        print(f"Warning: Failed to fetch API key from database for {user_id}: {str(e)}")

    # Fallback to backend settings
    val = None
    if provider == "openai":
        val = settings.OPENAI_API_KEY
    elif provider == "anthropic":
        val = settings.ANTHROPIC_API_KEY

    # Check that fallback is valid (not empty and not a dummy placeholder)
    if val and not val.startswith("dummy") and not val.startswith("sk-proj-dummy") and not val.startswith("sk-ant-dummy"):
        return val.strip()

    provider_label = {
        "openai": "OpenAI",
        "anthropic": "Anthropic Claude",
        "google": "Google Gemini"
    }.get(provider, provider.capitalize())

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Missing {provider_label} API Key. Please add your own API Key in the Settings page to use this feature."
    )


@router.get("/keys", response_model=List[UserApiKeyStatus])
async def get_api_keys(current_user: Any = Depends(get_current_user)):
    """
    Get the status of registered API keys for the current user (masked for security).
    """
    providers = ["openai", "anthropic", "google"]
    results = []
    
    try:
        response = supabase_admin.table("user_api_keys") \
            .select("provider, api_key") \
            .eq("user_id", str(current_user.id)) \
            .execute()
        
        db_keys = {item["provider"]: item["api_key"] for item in response.data}
        
        for p in providers:
            if p in db_keys:
                results.append(UserApiKeyStatus(
                    provider=p,
                    has_key=True,
                    masked_key=mask_api_key(db_keys[p])
                ))
            else:
                results.append(UserApiKeyStatus(
                    provider=p,
                    has_key=False,
                    masked_key=""
                ))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch settings keys: {str(e)}"
        )
        
    return results


@router.post("/keys", status_code=status.HTTP_200_OK)
async def save_api_key(payload: UserApiKeyInput, current_user: Any = Depends(get_current_user)):
    """
    Register or update an API key for a provider.
    """
    provider = payload.provider.lower().strip()
    key = payload.api_key.strip()
    
    if provider not in ["openai", "anthropic", "google"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported provider. Must be one of: 'openai', 'anthropic', 'google'."
        )
        
    if not key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API Key cannot be empty."
        )
        
    # Basic validation formats
    if provider == "openai" and not key.startswith("sk-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OpenAI API Key format. Should start with 'sk-'."
        )
    elif provider == "anthropic" and not key.startswith("sk-ant-"):
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Anthropic API Key format. Should start with 'sk-ant-'."
        )
    elif provider == "google" and len(key) < 15:
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Google API Key. Key length is too short."
         )

    try:
        # Self-healing sync: Ensure a corresponding row exists in public.users to prevent foreign key errors
        user_res = supabase_admin.table("users").select("id").eq("id", str(current_user.id)).execute()
        if not user_res.data:
            supabase_admin.table("users").insert({
                "id": str(current_user.id),
                "email": current_user.email,
                "full_name": current_user.user_metadata.get("full_name") or current_user.user_metadata.get("name") or ""
            }).execute()

        record = {
            "user_id": str(current_user.id),
            "provider": provider,
            "api_key": key
        }
        
        # Perform upsert matching user_id + provider constraint
        supabase_admin.table("user_api_keys").upsert(
            record, 
            on_conflict="user_id,provider"
        ).execute()
        
        return {"detail": f"Successfully updated API key for {provider}."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database update failed: {str(e)}"
        )


@router.delete("/keys/{provider}", status_code=status.HTTP_200_OK)
async def delete_api_key(provider: str, current_user: Any = Depends(get_current_user)):
    """
    Delete the registered API key for a provider.
    """
    p = provider.lower().strip()
    if p not in ["openai", "anthropic", "google"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported provider. Must be one of: 'openai', 'anthropic', 'google'."
        )
        
    try:
        supabase_admin.table("user_api_keys") \
            .delete() \
            .eq("user_id", str(current_user.id)) \
            .eq("provider", p) \
            .execute()
        return {"detail": f"Successfully deleted API key for {p}."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database delete failed: {str(e)}"
        )
