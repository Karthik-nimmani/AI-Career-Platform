"""
Core provider client loader.
Dynamically resolves and initializes LLMs (OpenAI, Anthropic, Google Gemini) 
and Embedding models based on user settings keys and active configurations.
"""

from fastapi import HTTPException, status
from typing import Optional, Tuple
from app.core.config import settings
from app.api.routes.settings import resolve_api_key

def get_user_llm(user_id: str, temperature: float = 0.0, preferred_provider: Optional[str] = None):
    """
    Dynamically loads and returns a LangChain chat model instance (OpenAI, Anthropic Claude, or Google Gemini)
    based on the user's saved API keys in settings.
    Priority: Google Gemini -> Anthropic Claude -> OpenAI.
    """
    openai_key = None
    try:
        openai_key = resolve_api_key(user_id, "openai")
    except:
        pass

    anthropic_key = None
    try:
        anthropic_key = resolve_api_key(user_id, "anthropic")
    except:
        pass

    google_key = None
    try:
        google_key = resolve_api_key(user_id, "google")
    except:
        pass

    # Resolve provider
    provider = preferred_provider
    if not provider:
        if google_key:
            provider = "google"
        elif anthropic_key:
            provider = "anthropic"
        elif openai_key:
            provider = "openai"
        else:
            # Enforce check, which raises a 400 error listing instructions
            resolve_api_key(user_id, "openai")

    if provider == "google" and google_key:
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=temperature,
            google_api_key=google_key
        )
    elif provider == "anthropic" and anthropic_key:
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model="claude-3-5-sonnet-latest",
            temperature=temperature,
            anthropic_api_key=anthropic_key
        )
    elif provider == "openai" and openai_key:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model="gpt-4o-mini",
            temperature=temperature,
            openai_api_key=openai_key
        )
    else:
        # If the preferred provider key is missing, raise clear error
        provider_label = {"openai": "OpenAI", "anthropic": "Anthropic Claude", "google": "Google Gemini"}.get(provider, provider)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing {provider_label} API Key. Please configure your key in settings."
        )


def get_user_embeddings(user_id: str) -> Tuple[any, str]:
    """
    Resolves and returns a tuple of (LangChain Embeddings Instance, provider_name).
    Selects Google Gemini embeddings if google key exists, otherwise OpenAI embeddings.
    """
    openai_key = None
    try:
        openai_key = resolve_api_key(user_id, "openai")
    except:
        pass

    google_key = None
    try:
        google_key = resolve_api_key(user_id, "google")
    except:
        pass

    if google_key:
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        return GoogleGenerativeAIEmbeddings(
            model="models/text-embedding-004",
            google_api_key=google_key
        ), "google"
    elif openai_key:
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=openai_key
        ), "openai"
    else:
        # Enforce check, which raises 400 error
        resolve_api_key(user_id, "openai")
