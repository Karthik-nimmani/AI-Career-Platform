"""
Vector similarity matching module.
Calculates semantic cosine similarity between resume chunks in ChromaDB and job description embeddings.
"""

from typing import Optional
import numpy as np
from app.embeddings.vector_store import get_resume_collection, get_embedding


def calculate_cosine_similarity(v1: list[float], v2: list[float]) -> float:
    """
    Compute the cosine similarity between two numeric vectors.
    """
    arr1 = np.array(v1)
    arr2 = np.array(v2)
    
    dot_product = np.dot(arr1, arr2)
    norm1 = np.linalg.norm(arr1)
    norm2 = np.linalg.norm(arr2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
        
    return float(dot_product / (norm1 * norm2))


def get_resume_jd_similarity(user_id: str, resume_id: str, jd_text: str) -> float:
    """
    Generates embedding for job description, retrieves resume chunk vectors
    from ChromaDB, and calculates the maximum cosine similarity score.
    Returns a float between 0.0 and 1.0.
    """
    from app.core.providers import get_user_embeddings
    embeddings_impl, provider_name = get_user_embeddings(user_id)
    
    # 1. Generate embedding vector for the job description
    try:
        jd_vector = embeddings_impl.embed_query(jd_text)
    except Exception as e:
        raise ValueError(f"Failed to generate query embedding via {provider_name}: {str(e)}")
    
    # 2. Retrieve all chunk vectors for the target resume from ChromaDB using provider collection
    collection = get_resume_collection(provider_name)
    results = collection.get(
        where={"resume_id": str(resume_id)},
        include=["embeddings"]
    )
    
    embeddings = results.get("embeddings")
    if not embeddings:
        # Fallback if ChromaDB indexing is missing
        return 0.0
        
    # 3. Calculate cosine similarity for each chunk
    similarities = []
    for chunk_vector in embeddings:
        sim = calculate_cosine_similarity(chunk_vector, jd_vector)
        similarities.append(sim)
        
    # 4. Return maximum semantic matching score (or average)
    if not similarities:
        return 0.0
        
    max_sim = max(similarities)
    # Ensure it's between 0.0 and 1.0 (cosine similarity can be negative, so clamp to 0)
    return max(0.0, min(1.0, max_sim))
