"""
PDF resume parser module.
Uses LlamaIndex to extract raw text from PDF files,
and OpenAI GPT-4o-mini structured outputs to parse metadata into structured JSON.
"""

import os
import tempfile
from typing import List, Optional
from pydantic import BaseModel, Field
from openai import OpenAI
from llama_index.core import SimpleDirectoryReader
from app.core.config import settings

# Initialize OpenAI client
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY or "dummy-key")


class ExperienceItem(BaseModel):
    company: str = Field(..., description="Name of the company or organization")
    role: str = Field(..., description="Job title or role")
    duration: Optional[str] = Field(None, description="Employment dates, e.g., 'Jan 2020 - Present'")
    description: Optional[str] = Field(None, description="Brief summary of duties and accomplishments")


class EducationItem(BaseModel):
    institution: str = Field(..., description="Name of the university, college, or school")
    degree: Optional[str] = Field(None, description="Degree achieved, e.g., 'B.S.', 'M.S.'")
    field_of_study: Optional[str] = Field(None, description="Major or field of study")
    graduation_year: Optional[str] = Field(None, description="Year of graduation or expected graduation")


class ResumeData(BaseModel):
    name: str = Field(..., description="Candidate's full name")
    email: Optional[str] = Field(None, description="Candidate's email address")
    phone: Optional[str] = Field(None, description="Candidate's phone number")
    skills: List[str] = Field(default_factory=list, description="Extracted list of technical and soft skills")
    experience: List[ExperienceItem] = Field(default_factory=list, description="Candidate's work history")
    education: List[EducationItem] = Field(default_factory=list, description="Candidate's educational history")


def parse_pdf_resume(file_bytes: bytes, llm: any) -> tuple[ResumeData, str]:
    """
    Parses a PDF resume by:
    1. Extracting text via LlamaIndex's SimpleDirectoryReader.
    2. Extracting structured metadata via LangChain's structured LLM output wrapper.
    
    Returns a tuple of (ResumeData schema object, raw extracted text).
    """
    # Create a temporary file to write the PDF bytes to
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
        temp_file.write(file_bytes)
        temp_file_path = temp_file.name
        
    try:
        # Load and extract text using LlamaIndex SimpleDirectoryReader
        reader = SimpleDirectoryReader(input_files=[temp_file_path])
        documents = reader.load_data()
        raw_text = "\n".join([doc.text for doc in documents])
        
        if not raw_text.strip():
            raise ValueError("No text could be extracted from the PDF resume.")
            
        # Bind structured output schema to the user-preferred LLM
        structured_llm = llm.with_structured_output(ResumeData)
        
        from langchain_core.prompts import ChatPromptTemplate
        prompt = ChatPromptTemplate.from_messages([
            (
                "system", 
                "You are a professional ATS resume parsing assistant. Extract all relevant profile information from the raw resume text provided into the requested structured schema."
            ),
            (
                "user", 
                "{raw_text}"
            )
        ])
        
        # Invoke LangChain structured pipeline
        chain = prompt | structured_llm
        parsed_data = chain.invoke({"raw_text": raw_text})
        
        if parsed_data is None:
            raise ValueError("LLM failed to parse the resume text into the required format.")
            
        return parsed_data, raw_text
        
    finally:
        # Safely remove the temporary file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
