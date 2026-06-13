"""
FastAPI router for the AI Career Mentor.
Exposes a Server-Sent Events (SSE) streaming chat endpoint and chat history retrieval.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import json
import asyncio

from app.api.routes.auth import get_current_user
from app.db.supabase_client import supabase_admin
from app.agents.orchestrator import route_intent, get_agent_prompt
from app.core.config import settings

router = APIRouter(prefix="/mentor", tags=["mentor"])


class ChatMessageInput(BaseModel):
    role: str = Field(..., description="Role of the sender: 'user' or 'assistant'")
    content: str = Field(..., description="Text content of the message")


class ChatRequest(BaseModel):
    messages: List[ChatMessageInput] = Field(..., description="The conversation history up to the latest user message.")


@router.post("/chat")
async def mentor_chat_stream(
    payload: ChatRequest,
    current_user: Any = Depends(get_current_user)
):
    """
    Initiates a streaming chat session with the AI Career Mentor:
    1. Fetches candidate's latest resume raw text.
    2. Runs LangGraph intent classifier.
    3. Streams response tokens via Server-Sent Events (SSE).
    4. Caches user & assistant messages in PostgreSQL chat_history.
    """
    if not payload.messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chat history cannot be empty."
        )

    # 1. Fetch user's latest resume from Supabase for context injection
    resume_context = None
    try:
        resume_res = supabase_admin.table("resumes") \
            .select("raw_text") \
            .eq("user_id", str(current_user.id)) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        if resume_res.data:
            resume_context = resume_res.data[0]["raw_text"]
    except Exception as e:
        print(f"Warning: Failed to fetch resume context: {str(e)}")

    # Format incoming history for Graph routing
    formatted_history = [{"role": msg.role, "content": msg.content} for msg in payload.messages]

    # Save user query immediately to the database (before streaming begins)
    query = payload.messages[-1].content
    try:
        supabase_admin.table("chat_history").insert(
            {"user_id": str(current_user.id), "message": query, "sender": "user"}
        ).execute()
    except Exception as db_err:
        print(f"Warning: Failed to save user query: {str(db_err)}")

    async def sse_event_generator():
        # A. Execute LangGraph Router node to determine query intent
        initial_state = {
            "messages": formatted_history,
            "user_id": str(current_user.id),
            "resume_context": resume_context,
            "next_agent": None,
            "classification_explanation": None
        }
        
        # Run synchronous router inside executor to prevent event-loop block
        loop = asyncio.get_running_loop()
        routed_state = await loop.run_in_executor(None, route_intent, initial_state)
        next_agent = routed_state["next_agent"] or "career"
        explanation = routed_state["classification_explanation"] or "Default routing activated."

        # B. Yield the routing event metadata first so frontend knows who is talking
        yield f"data: {json.dumps({'event': 'route', 'agent': next_agent, 'explanation': explanation})}\n\n"
        await asyncio.sleep(0.05) # Brief pause to allow browser connection processing

        # C. Format historical messages for LangChain Core
        from langchain_core.messages import HumanMessage, AIMessage
        chat_history = []
        for msg in payload.messages[:-1]:
            if msg.role == "user":
                chat_history.append(HumanMessage(content=msg.content))
            else:
                chat_history.append(AIMessage(content=msg.content))

        # D. Retrieve prompt for selected agent
        prompt_template = get_agent_prompt(next_agent, resume_context)
        formatted_messages = prompt_template.format_messages(
            chat_history=chat_history,
            query=query
        )

        # E. Initialize specialized LLM and stream tokens dynamically based on user settings keys
        from app.api.routes.settings import resolve_api_key
        
        # Resolve keys with safe exceptions
        openai_key = None
        try:
            openai_key = resolve_api_key(current_user.id, "openai")
        except:
            pass

        anthropic_key = None
        try:
            anthropic_key = resolve_api_key(current_user.id, "anthropic")
        except:
            pass

        google_key = None
        try:
            google_key = resolve_api_key(current_user.id, "google")
        except:
            pass

        # Select provider based on active agent and key availability
        if next_agent == "career" and anthropic_key:
            from langchain_anthropic import ChatAnthropic
            llm = ChatAnthropic(
                model="claude-3-5-sonnet-latest",
                temperature=0.7,
                anthropic_api_key=anthropic_key
            )
        elif next_agent == "career" and google_key:
            from langchain_google_genai import ChatGoogleGenerativeAI
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-pro",
                temperature=0.7,
                google_api_key=google_key
            )
        else:
            # Default fallback: OpenAI (require it if not resolved, which raises a 400 error)
            if not openai_key:
                openai_key = resolve_api_key(current_user.id, "openai")
                
            from langchain_openai import ChatOpenAI
            llm = ChatOpenAI(
                model="gpt-4o",
                temperature=0.7,
                openai_api_key=openai_key
            )
        
        full_reply = ""
        try:
            try:
                async for chunk in llm.astream(formatted_messages):
                    token = chunk.content
                    full_reply += token
                    yield f"data: {json.dumps({'event': 'token', 'text': token})}\n\n"
            except Exception as stream_err:
                yield f"data: {json.dumps({'event': 'error', 'detail': str(stream_err)})}\n\n"
        finally:
            # Save assistant reply in finally block to ensure it's written even if client disconnects
            if full_reply.strip():
                try:
                    supabase_admin.table("chat_history").insert(
                        {"user_id": str(current_user.id), "message": full_reply, "sender": "assistant"}
                    ).execute()
                except Exception as db_err:
                    print(f"Warning: Failed to save assistant reply: {str(db_err)}")

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no" # Prevents Nginx response buffering
        }
    )


@router.get("/history", response_model=List[Dict[str, Any]])
async def get_chat_history(current_user: Any = Depends(get_current_user)):
    """
    Get previous message history log for the current user.
    """
    try:
        response = supabase_admin.table("chat_history") \
            .select("id, message, sender, created_at") \
            .eq("user_id", str(current_user.id)) \
            .order("created_at", asc=True) \
            .execute()
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve chat histories: {str(e)}"
        )


@router.delete("/history", status_code=status.HTTP_200_OK)
async def delete_chat_history(current_user: Any = Depends(get_current_user)):
    """
    Reset/delete all chat history records for the current user.
    """
    try:
        supabase_admin.table("chat_history") \
            .delete() \
            .eq("user_id", str(current_user.id)) \
            .execute()
        return {"detail": "Successfully cleared all chat history logs."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete chat history: {str(e)}"
        )

