"""
Resume embedding and indexing pipeline.
Splits text into overlapping chunks, generates embeddings, and stores them in ChromaDB.
"""

from typing import Optional
from app.embeddings.vector_store import get_resume_collection, get_embedding


def split_text(text: str, chunk_size: int = 150, overlap: int = 30) -> list[str]:
    """
    Split text into chunks of specified word length with sliding overlap.
    """
    words = text.split()
    if not words:
        return []
    
    if len(words) <= chunk_size:
        return [text]
    
    chunks = []
    step = chunk_size - overlap
    # Ensure step is at least 1 to prevent infinite loop
    if step <= 0:
        step = chunk_size // 2 or 1
        
    for i in range(0, len(words), step):
        chunk_words = words[i:i + chunk_size]
        chunks.append(" ".join(chunk_words))
        if i + chunk_size >= len(words):
            break
            
    return chunks


def embed_and_store_resume(user_id: str, resume_id: str, raw_text: str) -> int:
    """
    Chunks a resume, embeds each chunk, and saves them to local ChromaDB.
    Uses the user's active provider (OpenAI or Gemini) and batch embeds chunks.
    """
    if not raw_text or not raw_text.strip():
        return 0

    from app.core.providers import get_user_embeddings
    embeddings_impl, provider_name = get_user_embeddings(user_id)
    collection = get_resume_collection(provider_name)
    
    chunks = split_text(raw_text)
    if not chunks:
        return 0

    # Batch embed the documents to save API roundtrips
    try:
        vectors = embeddings_impl.embed_documents(chunks)
    except Exception as e:
        raise ValueError(f"Failed to generate batch embeddings via {provider_name}: {str(e)}")
    
    ids = []
    embeddings = []
    documents = []
    metadatas = []
    
    for index, chunk in enumerate(chunks):
        chunk_id = f"{resume_id}_chunk_{index}"
        
        ids.append(chunk_id)
        embeddings.append(vectors[index])
        documents.append(chunk)
        metadatas.append({
            "user_id": str(user_id),
            "resume_id": str(resume_id),
            "chunk_index": index
        })
        
    if ids:
        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )
        
    return len(ids)
