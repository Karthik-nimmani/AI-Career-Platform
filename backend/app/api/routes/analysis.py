"""
FastAPI router for job analysis and resume matching.
Runs LangChain comparison chains, computes vector similarity, and saves comparison reports.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime

from app.api.routes.auth import get_current_user
from app.db.supabase_client import supabase_admin
from app.chains.ats_chain import get_ats_score_chain
from app.chains.skill_gap_chain import get_skill_gap_chain
from app.chains.roadmap_chain import get_roadmap_chain
from app.embeddings.vector_similarity import get_resume_jd_similarity
from app.core.providers import get_user_llm

router = APIRouter(prefix="/analysis", tags=["analysis"])


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
    # Resolve user's preferred LLM
    llm = get_user_llm(current_user.id, temperature=0.0)

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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query resume database: {str(e)}"
        )

    # 2. Run LangChain scoring and evaluations
    try:
        ats_chain = get_ats_score_chain(llm=llm)
        ats_report = ats_chain.invoke({
            "resume_text": resume_text,
            "jd_text": payload.jd_text
        })
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LangChain ATS score chain failed: {str(e)}"
        )

    try:
        gap_chain = get_skill_gap_chain(llm=llm)
        gap_report = gap_chain.invoke({
            "resume_text": resume_text,
            "jd_text": payload.jd_text
        })
    except Exception as e:
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
        print(f"Warning: ChromaDB similarity calculation failed: {str(e)}")
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
        print(f"Warning: Failed to sync user profile: {str(sync_err)}")

    try:
        # Save JD
        supabase_admin.table("job_descriptions").insert(jd_record).execute()
        # Save Analysis
        db_res = supabase_admin.table("analyses").insert(analysis_record).execute()
        if not db_res.data:
            raise ValueError("No record created in PostgreSQL analyses database.")
    except Exception as db_err:
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


@router.get("/my", response_model=List[Dict[str, Any]])
async def get_my_analyses(current_user: Any = Depends(get_current_user)):
    """
    Get matching histories for the currently logged in user.
    """
    try:
        response = supabase_admin.table("analyses") \
            .select("id, ats_score, match_percentage, created_at, resume_id, jd_id, roadmap") \
            .eq("user_id", str(current_user.id)) \
            .order("created_at", desc=True) \
            .execute()
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch matching analyses: {str(e)}"
        )


@router.get("/{analysis_id}", response_model=Dict[str, Any])
async def get_analysis_by_id(
    analysis_id: str,
    current_user: Any = Depends(get_current_user)
):
    """
    Get full comparison details of a specific analysis record.
    """
    try:
        response = supabase_admin.table("analyses") \
            .select("*, job_descriptions(title, company, jd_text)") \
            .eq("id", analysis_id) \
            .eq("user_id", str(current_user.id)) \
            .execute()
            
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Analysis report not found."
            )
            
        return response.data[0]
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch report details: {str(e)}"
        )


@router.post("/{analysis_id}/roadmap")
async def generate_roadmap(
    analysis_id: str,
    current_user: Any = Depends(get_current_user)
):
    """
    Generate a custom learning roadmap based on missing skills for a specific match report.
    If already compiled, returns the cached copy from PostgreSQL.
    """
    try:
        # Fetch analysis and target job title in one database query
        res = supabase_admin.table("analyses") \
            .select("*, job_descriptions(title)") \
            .eq("id", analysis_id) \
            .eq("user_id", str(current_user.id)) \
            .execute()

        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Matching analysis report not found."
            )

        analysis = res.data[0]
        
        # If study roadmap is already generated, return cached payload
        if analysis.get("roadmap"):
            return analysis["roadmap"]

        # Validate that skill gaps exist
        skill_gaps_obj = analysis.get("skill_gaps") or {}
        missing_skills = skill_gaps_obj.get("missing_skills") or []
        
        target_role = analysis.get("job_descriptions", {}).get("title") or "Target Job Position"

        if not missing_skills:
            # If no gaps, return empty study plan immediately
            perfect_roadmap = {
                "duration_weeks": 0,
                "target_role": target_role,
                "weeks": [],
                "message": "Perfect match! No missing skills were isolated, so no roadmap is required."
            }
            # Cache it
            supabase_admin.table("analyses") \
                .update({"roadmap": perfect_roadmap}) \
                .eq("id", analysis_id) \
                .execute()
            return perfect_roadmap

        # Invoke the LangChain Roadmap Generator Chain
        try:
            # Resolve user's preferred LLM
            llm_roadmap = get_user_llm(current_user.id, temperature=0.2)
            roadmap_chain = get_roadmap_chain(llm=llm_roadmap)
            roadmap_report = roadmap_chain.invoke({
                "target_role": target_role,
                "missing_skills": ", ".join(missing_skills)
            })
        except Exception as chain_err:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"LangChain roadmap generator pipeline failed: {str(chain_err)}"
            )

        # Cache the compiled roadmap back to the analyses table
        try:
            supabase_admin.table("analyses") \
                .update({"roadmap": roadmap_report.model_dump()}) \
                .eq("id", analysis_id) \
                .execute()
        except Exception as db_err:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to record roadmap output: {str(db_err)}"
            )

        return roadmap_report.model_dump()

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during roadmap compilation: {str(e)}"
        )


@router.delete("/{analysis_id}", status_code=status.HTTP_200_OK)
async def delete_analysis(
    analysis_id: str,
    current_user: Any = Depends(get_current_user)
):
    """
    Delete a specific analysis report and its associated job description:
    1. Verify user ownership and retrieve jd_id.
    2. Delete the analysis record from PostgreSQL.
    3. Delete the associated job description record to clean up space.
    """
    try:
        response = supabase_admin.table("analyses") \
            .select("jd_id") \
            .eq("id", analysis_id) \
            .eq("user_id", str(current_user.id)) \
            .execute()
            
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Analysis report not found or does not belong to you."
            )
        
        jd_id = response.data[0]["jd_id"]
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {str(e)}"
        )

    # Delete the analysis row
    try:
        supabase_admin.table("analyses") \
            .delete() \
            .eq("id", analysis_id) \
            .eq("user_id", str(current_user.id)) \
            .execute()
    except Exception as db_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete analysis: {str(db_err)}"
        )

    # Delete the associated job description row
    try:
        supabase_admin.table("job_descriptions") \
            .delete() \
            .eq("id", jd_id) \
            .eq("user_id", str(current_user.id)) \
            .execute()
    except Exception as jd_err:
        print(f"Warning: Failed to delete associated job description {jd_id}: {jd_err}")

    return {"detail": "Successfully deleted analysis report and job description details."}


@router.delete("/{analysis_id}/roadmap", status_code=status.HTTP_200_OK)
async def delete_roadmap(
    analysis_id: str,
    current_user: Any = Depends(get_current_user)
):
    """
    Delete/reset the generated roadmap for a specific analysis record by setting it to None.
    """
    try:
        response = supabase_admin.table("analyses") \
            .update({"roadmap": None}) \
            .eq("id", analysis_id) \
            .eq("user_id", str(current_user.id)) \
            .execute()
            
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Analysis report not found or does not belong to you."
            )
            
        return {"detail": "Successfully deleted the learning roadmap."}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset roadmap: {str(e)}"
        )


