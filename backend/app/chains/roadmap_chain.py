"""
LangChain Learning Roadmap Generation Chain.
Given technical skill gaps, generates a structured 4-12 week learning plan with resource links.
"""

from typing import Optional
from pydantic import BaseModel, Field
from typing import List
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from app.core.config import settings


class ResourceItem(BaseModel):
    name: str = Field(..., description="Name of the article, documentation, or tutorial.")
    url: str = Field(..., description="Valid absolute URL to the study resource (e.g. https://react.dev).")
    category: str = Field(..., description="Resource format, e.g. 'documentation', 'video', 'tutorial', 'article'")


class WeeklyModule(BaseModel):
    week_number: int = Field(..., description="Week index (1, 2, 3...)")
    title: str = Field(..., description="Concise weekly theme title.")
    description: str = Field(..., description="Syllabus overview of the week's goals.")
    topics: List[str] = Field(..., description="Specific sub-skills, keywords, or exercises to practice.")
    resources: List[ResourceItem] = Field(..., description="List of learning URLs to study.")


class StudyRoadmap(BaseModel):
    duration_weeks: int = Field(..., description="Total weeks of the roadmap (typically 4 to 12).")
    target_role: str = Field(..., description="Name of the target job position.")
    weeks: List[WeeklyModule] = Field(..., description="Sequential week-by-week study syllabus list.")


def get_roadmap_chain(llm: any):
    """
    Constructs and returns an LCEL chain for structured roadmap compilation.
    """
    # Bind structured output schema
    structured_llm = llm.with_structured_output(StudyRoadmap)
    
    # Define prompt
    prompt = ChatPromptTemplate.from_messages([
        (
            "system", 
            "You are a Senior Technical Curriculum Architect and Devops/Software Engineering Trainer. "
            "Design a comprehensive, structured study roadmap (4 to 12 weeks) to help a developer bridge the gap "
            "between their profile and a target job role by mastering a list of missing technical skills. "
            "Provide a week-by-week modules list with clear practice topics. "
            "For each week, provide 2-3 links to high-quality study resources (prefer official documentation like "
            "react.dev, developer.mozilla.org, python.org, docs.docker.com, aws.amazon.com/developer, etc.). "
            "Ensure the URL links are real, valid, and absolute HTTPS URLs."
        ),
        (
            "user", 
            "TARGET ROLE:\n{target_role}\n\n"
            "MISSING SKILLS:\n{missing_skills}"
        )
    ])
    
    # Composable LCEL chain
    return prompt | structured_llm
