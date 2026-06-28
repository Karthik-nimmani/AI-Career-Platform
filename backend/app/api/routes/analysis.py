"""
FastAPI router for job analysis and resume matching.
Runs LangChain comparison chains, computes vector similarity, and saves comparison reports.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime
import logging

from app.api.routes.auth import get_current_user
from app.db.supabase_client import supabase_admin
from app.chains.ats_chain import get_ats_score_chain
from app.chains.skill_gap_chain import get_skill_gap_chain
from app.chains.roadmap_chain import get_roadmap_chain
from app.embeddings.vector_similarity import get_resume_jd_similarity

router = APIRouter(prefix="/analysis", tags=["analysis"])
logger = logging.getLogger(__name__)


class CompareRequest(BaseModel):
    resume_id: str = Field(..., description="The UUID of the resume to compare.")
    jd_text: str = Field(..., description="Raw text of the target job description.")
    title: Optional[str] = Field(None, description="Job title of the target position.")
    company: Optional[str] = Field(None, description="Company name of the target position.")


class SkillGapsPayload(BaseModel):
    missing_skills: List[str]
    matched_skills: List[str]
    explanation: str


class CompareResponse(BaseModel):
    id: str
    resume_id: str
    jd_id: str
    ats_score: int
    match_percentage: int
    vector_score: int
    skill_gaps: SkillGapsPayload
    improvement_suggestions: List[str]
    created_at: str


@router.post("/compare", response_model=CompareResponse, status_code=status.HTTP_201_CREATED)
async def compare_resume_to_jd(
    payload: CompareRequest,
    current_user: Any = Depends(get_current_user)
):
    """
    Compare an uploaded resume against a target job description:
    1. Runs LangChain ATS Scoring
    2. Runs LangChain Skill Gap and Suggestion extraction
    3. Calculates ChromaDB semantic vector cosine similarity
    4. Combines results and saves to PostgreSQL job_descriptions & analyses tables
    """

    # Validate JD text immediately before any external calls
    if not payload.jd_text or not payload.jd_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job description text cannot be empty."
        )

    # 1. Fetch target resume from Supabase to verify existence and get text
    try:
        resume_res = supabase_admin.table("resumes") \
            .select("raw_text") \
            .eq("id", payload.resume_id) \
            .eq("user_id", str(current_user.id)) \
            .execute()
            
        if not resume_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected resume was not found or does not belong to you."
            )
            
        resume_text = resume_res.data[0]["raw_text"]
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.warning("Failed to query resume database: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query resume database: {str(e)}"
        )

    # 2. Run LangChain scoring and evaluations
    try:
        # Pass-through llm is not required at this layer; chains are unit-tested/mocked
        ats_chain = get_ats_score_chain(llm=None)
        ats_report = ats_chain.invoke({
            "resume_text": resume_text,
            "jd_text": payload.jd_text
        })
    except Exception as e:
        logger.warning("LangChain ATS score chain failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LangChain ATS score chain failed: {str(e)}"
        )

    try:
        gap_chain = get_skill_gap_chain(llm=None)
        gap_report = gap_chain.invoke({
            "resume_text": resume_text,
            "jd_text": payload.jd_text
        })
    except Exception as e:
        logger.warning("LangChain skill gap analysis failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LangChain skill gap analysis failed: {str(e)}"
        )

    # 3. Calculate semantic cosine similarity from ChromaDB
    try:
        vector_similarity = get_resume_jd_similarity(
            user_id=current_user.id,
            resume_id=payload.resume_id,
            jd_text=payload.jd_text
        )
        vector_score = int(vector_similarity * 100)
    except Exception as e:
        # Fallback if ChromaDB query fails (e.g. key errors or missing directory)
        logger.warning("ChromaDB similarity calculation failed: %s", str(e))
        vector_score = 0

    # 4. Compute overall Match Percentage
    # Weighted average: 70% LLM evaluative score + 30% vector semantic match
    match_percentage = int((ats_report.score * 0.7) + (vector_score * 0.3))

    # 5. Insert Job Description record
    jd_id = str(uuid.uuid4())
    jd_record = {
        "id": jd_id,
        "user_id": str(current_user.id),
        "title": payload.title or "Target Job Position",
        "company": payload.company or "Target Company",
        "jd_text": payload.jd_text
    }
    
    # 6. Insert Analysis report record
    analysis_id = str(uuid.uuid4())
    analysis_record = {
        "id": analysis_id,
        "user_id": str(current_user.id),
        "resume_id": str(payload.resume_id),
        "jd_id": jd_id,
        "ats_score": ats_report.score,
        "match_percentage": match_percentage,
        "skill_gaps": {
            "missing_skills": gap_report.missing_skills,
            "matched_skills": gap_report.matched_skills,
            "explanation": ats_report.explanation
        },
        "improvement_suggestions": gap_report.suggestions,
        "roadmap": None  # Populated in Phase 4
    }

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
        logger.warning("Failed to sync user profile: %s", str(sync_err))

    try:
        # Save JD
        supabase_admin.table("job_descriptions").insert(jd_record).execute()
        # Save Analysis
        db_res = supabase_admin.table("analyses").insert(analysis_record).execute()
        if not db_res.data:
            raise ValueError("No record created in PostgreSQL analyses database.")
    except Exception as db_err:
        logger.error("Failed to record analysis outputs to PostgreSQL: %s", str(db_err))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record analysis outputs to PostgreSQL: {str(db_err)}"
        )

    return CompareResponse(
        id=analysis_id,
        resume_id=payload.resume_id,
        jd_id=jd_id,
        ats_score=ats_report.score,
        match_percentage=match_percentage,
        vector_score=vector_score,
        skill_gaps=SkillGapsPayload(
            missing_skills=gap_report.missing_skills,
            matched_skills=gap_report.matched_skills,
            explanation=ats_report.explanation
        ),
        improvement_suggestions=gap_report.suggestions,
        created_at=datetime.now().isoformat()
    )
