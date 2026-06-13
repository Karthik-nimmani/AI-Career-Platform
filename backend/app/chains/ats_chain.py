"""
LangChain ATS Evaluation Chain.
Scores a resume against a job description using OpenAI GPT-4o.
"""

from typing import Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from app.core.config import settings


class ATSScoreReport(BaseModel):
    score: int = Field(
        ..., 
        description="ATS score out of 100 based on experience alignment, title congruence, and keyword alignment."
    )
    explanation: str = Field(
        ..., 
        description="A structured overview explaining the score, strengths detected, and formatting weaknesses."
    )


def get_ats_score_chain(llm: any):
    """
    Constructs and returns an LCEL chain for ATS scoring.
    """
    # Bind structured output schema
    structured_llm = llm.with_structured_output(ATSScoreReport)
    
    # Define the template
    prompt = ChatPromptTemplate.from_messages([
        (
            "system", 
            "You are an elite corporate technical recruiter and ATS algorithms specialist. "
            "Compare the candidate's resume content to the provided job description requirements. "
            "Evaluate experience level alignment, role responsibility matches, and general keyword densities. "
            "Return a score out of 100 (where 100 is a perfect match) along with a thorough recruitment-grade explanation."
        ),
        (
            "user", 
            "RESUME TEXT:\n{resume_text}\n\n"
            "JOB DESCRIPTION REQUIREMENTS:\n{jd_text}"
        )
    ])
    
    # Composable LCEL chain
    return prompt | structured_llm
