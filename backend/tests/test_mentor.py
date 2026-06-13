"""
Unit tests for the AI career mentor chat endpoints.
Mocks async generators, LangGraph router nodes, and database tables to test isolated logic.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
from app.main import app
from app.api.routes.auth import get_current_user

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    """
    Clear dependencies before and after each test.
    """
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def test_mentor_chat_unauthorized():
    """
    Test that calling mentor chat without an auth token returns 401 Unauthorized.
    """
    response = client.post(
        "/api/mentor/chat",
        json={"messages": [{"role": "user", "content": "hello"}]}
    )
    assert response.status_code == 401


def test_mentor_chat_empty_messages():
    """
    Test that calling mentor chat with empty messages list returns 422/400.
    """
    mock_user = MagicMock()
    mock_user.id = "user-123"
    app.dependency_overrides[get_current_user] = lambda: mock_user

    response = client.post(
        "/api/mentor/chat",
        json={"messages": []}
    )
    assert response.status_code == 400 # Custom bad request validation for empty chat history


@patch("app.api.routes.mentor.supabase_admin")
@patch("app.api.routes.mentor.route_intent")
@patch("langchain_openai.ChatOpenAI.astream")
def test_mentor_chat_stream_success(mock_astream, mock_router, mock_supabase):
    """
    Test successful Server-Sent Events (SSE) streaming chat execution.
    Verifies that the router determines the agent and the SSE generator streams token data.
    """
    # 1. Mock auth
    mock_user = MagicMock()
    mock_user.id = "user-uuid-12345"
    app.dependency_overrides[get_current_user] = lambda: mock_user

    # 2. Mock database query (fetching latest user resume)
    mock_table = MagicMock()
    mock_table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[{"raw_text": "Experienced React Developer"}]
    )
    mock_supabase.table.return_value = mock_table

    # 3. Mock LangGraph router classification (routing to 'resume' agent)
    mock_router.return_value = {
        "next_agent": "resume",
        "classification_explanation": "User asked about their profile resume."
    }

    # 4. Mock LangChain async generator stream tokens
    # astream returns an async generator yielding chunk structures
    class MockChunk:
        def __init__(self, content):
            self.content = content

    async def async_generator(*args, **kwargs):
        yield MockChunk("Hello")
        yield MockChunk(" John")
        yield MockChunk("!")

    mock_astream.side_effect = async_generator

    # 5. Mock Database logs (saving chat messages)
    mock_table.insert.return_value.execute.return_value = MagicMock(data=[{}])

    # 6. Call API (returns StreamingResponse)
    response = client.post(
        "/api/mentor/chat",
        json={"messages": [{"role": "user", "content": "Tell me about my profile"}]}
    )

    # 7. Assertions
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    
    # Read streamed lines
    lines = response.content.decode().split("\n\n")
    # Clean empty strings
    lines = [line for line in lines if line]

    assert len(lines) >= 5 # 1 routing event, 3 token events, 1 done event
    
    # Assert routing event
    assert "route" in lines[0]
    assert "resume" in lines[0]
    # Assert tokens
    assert "Hello" in lines[1]
    assert "John" in lines[2]
    assert "!" in lines[3]
    # Assert done
    assert "[DONE]" in lines[-1]
