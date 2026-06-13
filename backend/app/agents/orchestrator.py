"""
LangGraph Multi-Agent Orchestrator.
Defines the state graph, the router classifier, and specialized agent nodes (Resume, Career, Interview, Skill).
"""

from typing import TypedDict, List, Dict, Any, Optional
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from app.core.config import settings


# 1. Define Agent State Schema
class AgentState(TypedDict):
    messages: List[Dict[str, str]]    # [{role: user/assistant, content: text}]
    user_id: str
    resume_context: Optional[str]
    next_agent: Optional[str]
    classification_explanation: Optional[str]


# 2. Define Router Structured Output Schema
class QueryClassification(BaseModel):
    category: str = Field(
        ..., 
        description="Must be one of: 'resume' (questions about their uploaded resume/profile), "
                    "'career' (career growth, transition, role paths), "
                    "'interview' (practice questions, mock prep, feedback), "
                    "or 'skill' (how to learn a framework, study resources, libraries)."
    )
    explanation: str = Field(
        ..., 
        description="Reasoning for routing the query to this specific category."
    )


# Router Node function
def route_intent(state: AgentState) -> AgentState:
    """
    Analyzes the user's latest message and determines which specialized agent to query.
    """
    messages = state["messages"]
    if not messages:
        return {**state, "next_agent": "career", "classification_explanation": "Defaulting due to empty messages."}
        
    latest_query = messages[-1]["content"]
    user_id = state.get("user_id")
    
    # Dynamically resolve user-level OpenAI API Key
    openai_key = None
    if user_id:
        from app.api.routes.settings import resolve_api_key
        try:
            openai_key = resolve_api_key(user_id, "openai")
        except Exception:
            pass
            
    # Initialize a lightweight model for classification
    llm = ChatOpenAI(
        model="gpt-4o-mini", 
        temperature=0.0, 
        openai_api_key=openai_key or settings.OPENAI_API_KEY or "dummy-key"
    )
    structured_llm = llm.with_structured_output(QueryClassification)
    
    prompt = ChatPromptTemplate.from_messages([
        (
            "system", 
            "You are an intelligent intent routing agent. Classify the user's latest query into one of these four categories:\n"
            "- 'resume': Queries about their profile, skills listed on their resume, experiences, or updates to it.\n"
            "- 'career': Queries about career paths, career transitions, growth, salaries, or role timelines.\n"
            "- 'interview': Queries requesting mock interview prep, practice exercises, coding challenges, or behavioral questions.\n"
            "- 'skill': Queries asking for learning resources, tutorials, documentation, courses, or how to learn a technology.\n\n"
            "Return the category and a brief explanation."
        ),
        ("user", "USER QUERY: {query}")
    ])
    
    chain = prompt | structured_llm
    try:
        result = chain.invoke({"query": latest_query})
        category = result.category.lower().strip()
        # Validation fallback
        if category not in ["resume", "career", "interview", "skill"]:
            category = "career"
        return {
            **state, 
            "next_agent": category, 
            "classification_explanation": result.explanation
        }
    except Exception as e:
        # Graceful fallback to Career Agent on classification failure
        return {
            **state, 
            "next_agent": "career", 
            "classification_explanation": f"Routing error: {str(e)}. Fallback activated."
        }


# 3. Helper to fetch specialized agent LLM prompt templates
def get_agent_prompt(category: str, resume_context: Optional[str] = None) -> ChatPromptTemplate:
    """
    Constructs the system prompt for each specialized agent.
    """
    resume_info = resume_context if resume_context else "No resume has been uploaded yet."
    
    if category == "resume":
        system_prompt = (
            "You are the specialized Resume Agent, an expert ATS writer and resume editor.\n"
            "You have access to the candidate's raw parsed resume text below:\n"
            f"=== START RESUME CONTEXT ===\n{resume_info}\n=== END RESUME CONTEXT ===\n\n"
            "Answer the candidate's questions about their resume, highlight their strengths, "
            "recommend optimizations, and offer specific bullet points to improve their experience description."
        )
    elif category == "interview":
        system_prompt = (
            "You are the specialized Interview Coach Agent, a veteran technical interviewer.\n"
            "Generate mock technical (coding, architecture) or behavioral (STAR method) interview questions. "
            "If the user has a resume uploaded, customize the questions to their background:\n"
            f"=== START RESUME CONTEXT ===\n{resume_info}\n=== END RESUME CONTEXT ===\n\n"
            "Present one question at a time. If the user answers, evaluate their response and offer constructive feedback."
        )
    elif category == "skill":
        system_prompt = (
            "You are the specialized Skill Advisor Agent, a technical trainer.\n"
            "Recommend specific study books, documentation links, tutorials, and practical projects to master a framework or concept. "
            "Suggest official links (e.g. react.dev, docs.docker.com, python.org) and structure your advice clearly."
        )
    else: # career
        system_prompt = (
            "You are the primary AI Career Mentor, an elite career path advisor.\n"
            "Guide the user on career progression, role transitions, and long-term tech strategy. "
            "If they have a resume uploaded, refer to their background to make advice hyper-personalized:\n"
            f"=== START RESUME CONTEXT ===\n{resume_info}\n=== END RESUME CONTEXT ===\n\n"
            "Offer encouraging, professional, and actionable career pathways."
        )
        
    return ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        # Injects the historical chat messages
        ("placeholder", "{chat_history}"),
        ("user", "{query}")
    ])


# 4. Construct the LangGraph State Graph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("router", route_intent)

# Define mock placeholder nodes for the graph syntax definition
# (In streaming REST executions, we resolve routing in node 'router' and then 
# stream from the active prompt directly. However, we define the graph routes for completeness.)
def pass_through(state: AgentState) -> AgentState:
    return state

workflow.add_node("resume_node", pass_through)
workflow.add_node("career_node", pass_through)
workflow.add_node("interview_node", pass_through)
workflow.add_node("skill_node", pass_through)

# Set entry point
workflow.set_entry_point("router")

# Define conditional edges from router
def decider(state: AgentState) -> str:
    agent = state.get("next_agent", "career")
    if agent == "resume": return "resume_node"
    if agent == "interview": return "interview_node"
    if agent == "skill": return "skill_node"
    return "career_node"

workflow.add_conditional_edges(
    "router",
    decider,
    {
        "resume_node": "resume_node",
        "career_node": "career_node",
        "interview_node": "interview_node",
        "skill_node": "skill_node"
    }
)

# Connect end points
workflow.add_edge("resume_node", END)
workflow.add_edge("career_node", END)
workflow.add_edge("interview_node", END)
workflow.add_edge("skill_node", END)

# Compile graph
orchestrator_graph = workflow.compile()
