"""
LangChain Skill Gap and Resume Improvements Chain.
Compares resume content against a job description to isolate skill gaps and draft suggestions.
"""

from typing import Optional
from pydantic import BaseModel, Field
from typing import List
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from app.core.config import settings


class SkillGapReport(BaseModel):
    missing_skills: List[str] = Field(
        ..., 
        description="Key technical, framework, tool, or soft skills specified in the job description that are missing or weakly demonstrated in the resume."
    )
    matched_skills: List[str] = Field(
        ..., 
        description="Skills successfully matched and demonstrated in the resume that correspond to the job description."
    )
    suggestions: List[str] = Field(
        ..., 
        description="Specific, actionable bullet-point suggestions explaining exactly how the candidate can refine their resume phrasing or add details to better align with the job description."
    )


def get_skill_gap_chain(llm: any):
    """
    Constructs and returns an LCEL chain for skill gap and improvements analysis.
    """
    # Bind structured output schema
    structured_llm = llm.with_structured_output(SkillGapReport)
    
    # Define prompt
    prompt = ChatPromptTemplate.from_messages([
        (
            "system", 
            "You are a Senior Technical Recruiter and Career Optimization Advisor. "
            "Analyze the candidate's resume in relation to the target job description. "
            "1. Extract list of matched skills between resume and job description. "
            "2. Identify critical missing skills (skill gaps) requested in the job description but missing or weak in the resume. "
            "3. Generate highly specific, actionable suggestions (e.g. 'Add a bullet point under project X showing experience in AWS EC2') to improve the resume."
        ),
        (
            "user", 
            "RESUME TEXT:\n{resume_text}\n\n"
            "JOB DESCRIPTION REQUIREMENTS:\n{jd_text}"
        )
    ])
    
    # Composable LCEL chain
    return prompt | structured_llm
