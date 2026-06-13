"""
FastAPI router for resume management.
Handles PDF upload, Supabase Storage saving, LlamaIndex parsing, and ChromaDB vector indexing.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from typing import List, Dict, Any
import uuid
from datetime import datetime

from app.api.routes.auth import get_current_user
from app.db.supabase_client import supabase_admin
from app.parsers.pdf_parser import parse_pdf_resume, ResumeData
from app.embeddings.embed_resume import embed_and_store_resume
from app.core.providers import get_user_llm

router = APIRouter(prefix="/resume", tags=["resumes"])


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: Any = Depends(get_current_user)
):
    """
    Upload a resume PDF, parse it, save metadata to PostgreSQL, and embed it in ChromaDB.
    """
    # Resolve user's preferred LLM
    llm = get_user_llm(current_user.id, temperature=0.0)

    # 1. Validate file extension
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF resume uploads are supported."
        )

    try:
        # Read the file contents
        file_bytes = await file.read()
        
        # 2. Upload file to Supabase Storage
        resume_id = str(uuid.uuid4())
        # Store in user-specific folder in bucket with exact uploaded filename
        storage_path = f"{current_user.id}/{resume_id}/{file.filename}"
        
        try:
            supabase_admin.storage.from_("resumes").upload(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": "application/pdf"}
            )
        except Exception as storage_err:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    f"Supabase Storage upload failed: {str(storage_err)}. "
                    "Make sure you have created a public bucket named 'resumes' in Supabase Storage."
                )
            )

        # Retrieve the public URL for storage references
        file_url = supabase_admin.storage.from_("resumes").get_public_url(storage_path)

        # 3. Parse the PDF content with LlamaIndex + OpenAI
        try:
            structured_data, raw_text = parse_pdf_resume(file_bytes, llm=llm)
        except Exception as parse_err:
            # Clean up uploaded storage file on failure to maintain database-storage sync
            try:
                supabase_admin.storage.from_("resumes").remove([storage_path])
            except:
                pass
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to parse resume content: {str(parse_err)}"
            )

        # 4. Save metadata record to PostgreSQL public.resumes table
        try:
            # Self-healing sync: Ensure user profile exists
            user_res = supabase_admin.table("users").select("id").eq("id", str(current_user.id)).execute()
            if not user_res.data:
                supabase_admin.table("users").insert({
                    "id": str(current_user.id),
                    "email": current_user.email,
                    "full_name": current_user.user_metadata.get("full_name") or current_user.user_metadata.get("name") or ""
                }).execute()
        except Exception as sync_err:
            print(f"Warning: Failed to sync user profile: {str(sync_err)}")

        parsed_content_dict = structured_data.model_dump()
        parsed_content_dict["file_name"] = file.filename

        resume_record = {
            "id": resume_id,
            "user_id": str(current_user.id),
            "file_url": file_url,
            "parsed_content": parsed_content_dict,
            "raw_text": raw_text
        }

        try:
            db_response = supabase_admin.table("resumes").insert(resume_record).execute()
            if not db_response.data:
                raise ValueError("No record created in PostgreSQL resumes database.")
        except Exception as db_err:
            # Clean up storage on failure
            try:
                supabase_admin.storage.from_("resumes").remove([storage_path])
            except:
                pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database registration failed: {str(db_err)}"
            )

        # 5. Segment and embed raw text in local ChromaDB collection (auto-detects provider)
        try:
            chunks_count = embed_and_store_resume(
                user_id=current_user.id,
                resume_id=resume_id,
                raw_text=raw_text
            )
        except Exception as vector_err:
            # We don't fail the whole API response if vector store indexing fails,
            # but we flag it or handle it gracefully.
            # In local development, we want to warn the user.
            print(f"Warning: Failed to index vectors in ChromaDB: {str(vector_err)}")
            chunks_count = 0

        return {
            "id": resume_id,
            "file_url": file_url,
            "parsed_content": parsed_content_dict,
            "chunks_indexed": chunks_count,
            "created_at": datetime.now().isoformat()
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during resume ingestion: {str(e)}"
        )


@router.get("/my", response_model=List[Dict[str, Any]])
async def get_my_resumes(current_user: Any = Depends(get_current_user)):
    """
    Get all uploaded resumes belonging to the currently logged in user.
    """
    try:
        response = supabase_admin.table("resumes") \
            .select("id, file_url, parsed_content, created_at") \
            .eq("user_id", str(current_user.id)) \
            .order("created_at", desc=True) \
            .execute()
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch resumes: {str(e)}"
        )


@router.get("/{resume_id}", response_model=Dict[str, Any])
async def get_resume_by_id(
    resume_id: str,
    current_user: Any = Depends(get_current_user)
):
    """
    Get details of a specific resume by ID.
    """
    try:
        response = supabase_admin.table("resumes") \
            .select("*") \
            .eq("id", resume_id) \
            .eq("user_id", str(current_user.id)) \
            .execute()
            
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume record not found."
            )
            
        return response.data[0]
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve resume details: {str(e)}"
        )


@router.delete("/{resume_id}", status_code=status.HTTP_200_OK)
async def delete_resume(
    resume_id: str,
    current_user: Any = Depends(get_current_user)
):
    """
    Delete a specific resume:
    1. Verify user ownership.
    2. Remove PDF file from Supabase Storage.
    3. Remove vectors from ChromaDB.
    4. Delete metadata row from PostgreSQL database.
    """
    try:
        response = supabase_admin.table("resumes") \
            .select("file_url, parsed_content") \
            .eq("id", resume_id) \
            .eq("user_id", str(current_user.id)) \
            .execute()
            
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume record not found or does not belong to you."
            )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database lookup failed: {str(e)}"
        )

    # Delete file from Supabase Storage
    try:
        parsed_content = response.data[0].get("parsed_content") or {}
        filename = parsed_content.get("file_name")
        if filename:
            storage_path = f"{current_user.id}/{resume_id}/{filename}"
        else:
            storage_path = f"{current_user.id}/{resume_id}.pdf"
        supabase_admin.storage.from_("resumes").remove([storage_path])
    except Exception as storage_err:
        print(f"Warning: Supabase storage cleanup failed: {str(storage_err)}")

    # Delete vectors from ChromaDB
    try:
        from app.embeddings.vector_store import chroma_client
        for col in chroma_client.list_collections():
            try:
                col.delete(where={"resume_id": resume_id})
            except Exception as col_err:
                print(f"Warning: Failed to delete from collection {col.name}: {col_err}")
    except Exception as chroma_err:
        print(f"Warning: ChromaDB cleanup failed: {str(chroma_err)}")

    # Delete row from PostgreSQL database
    try:
        supabase_admin.table("resumes") \
            .delete() \
            .eq("id", resume_id) \
            .eq("user_id", str(current_user.id)) \
            .execute()
    except Exception as db_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database delete failed: {str(db_err)}"
        )

    return {"detail": "Successfully deleted resume and corresponding vector indices."}

