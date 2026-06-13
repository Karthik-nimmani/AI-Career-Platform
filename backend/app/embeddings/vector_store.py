"""
ChromaDB client and OpenAI embedding utility module.
Provides interface to persistent vector database.
"""

import os
import chromadb
from typing import Optional
from openai import OpenAI
from app.core.config import settings

# Initialize OpenAI client (requires API key)
# Note: we fallback to dummy key if not provided to allow startup, but real operations will require a valid key.
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY or "dummy-key")

# Initialize ChromaDB persistent client in the backend folder
chroma_client = chromadb.PersistentClient(path=os.path.join(os.path.dirname(__file__), "..", "..", "chroma_db"))


def get_embedding(text: str, model: str = "text-embedding-3-small", api_key: Optional[str] = None) -> list[float]:
    """
    Generate embeddings using OpenAI text-embedding-3-small model.
    """
    if not text or not text.strip():
        # Return a 1536-dimensional zero vector if text is empty
        return [0.0] * 1536
    
    # Use localized client if custom API key is passed
    client = OpenAI(api_key=api_key) if api_key else openai_client
    
    cleaned_text = text.replace("\n", " ")
    try:
        response = client.embeddings.create(
            input=[cleaned_text],
            model=model
        )
        return response.data[0].embedding
    except Exception as e:
        raise ValueError(f"Failed to generate OpenAI embedding: {str(e)}")


def get_resume_collection(provider_name: str = "openai"):
    """
    Get or create the resumes vector collection scoped by active provider.
    This separates 1536-dim OpenAI and 768-dim Google Gemini collections.
    """
    # Using default cosine similarity distance metric (ip / cosine / l2)
    name = f"resumes_{provider_name}"
    return chroma_client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"}
    )
