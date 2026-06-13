"""
Unit tests for the resume upload and parsing endpoints.
Uses FastAPI app.dependency_overrides to mock authentication contexts,
and patches external network calls to Supabase, OpenAI, and ChromaDB.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.api.routes.auth import get_current_user
from app.parsers.pdf_parser import ResumeData

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    """
    Fixture to clear overrides before and after each test to ensure test isolation.
    """
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def test_upload_resume_unauthorized():
    """
    Test that uploading a resume without an authentication token returns 401 Unauthorized.
    """
    response = client.post(
        "/api/resume/upload",
        files={"file": ("resume.pdf", b"pdf content", "application/pdf")}
    )
    # The endpoint security dependency returns 401 Unauthorized if no header is present
    assert response.status_code == 401


def test_upload_resume_invalid_file_type():
    """
    Test that uploading a non-PDF file returns a 400 Bad Request.
    """
    mock_user = MagicMock()
    mock_user.id = "user-uuid-12345"
    app.dependency_overrides[get_current_user] = lambda: mock_user

    response = client.post(
        "/api/resume/upload",
        files={"file": ("resume.txt", b"plain text content", "text/plain")}
    )
    assert response.status_code == 400
    assert "Only PDF" in response.json()["detail"]


@patch("app.api.routes.resume.supabase_admin")
@patch("app.api.routes.resume.parse_pdf_resume")
@patch("app.api.routes.resume.embed_and_store_resume")
def test_upload_resume_success(mock_embed, mock_parse, mock_supabase):
    """
    Test a successful resume upload, parsing, saving, and embedding sequence.
    """
    # 1. Configure auth override
    mock_user = MagicMock()
    mock_user.id = "user-uuid-12345"
    mock_user.email = "test@example.com"
    app.dependency_overrides[get_current_user] = lambda: mock_user

    # 2. Mock LlamaIndex & OpenAI parser output
    mock_resume_data = ResumeData(
        name="John Doe",
        email="john.doe@example.com",
        phone="123-456-7890",
        skills=["Python", "FastAPI", "React"],
        experience=[],
        education=[]
    )
    mock_parse.return_value = (mock_resume_data, "John Doe resume raw text details")

    # 3. Mock Supabase Storage upload
    mock_storage = MagicMock()
    mock_storage.upload.return_value = {}
    mock_storage.get_public_url.return_value = "https://supabase.co/storage/john_doe.pdf"
    mock_supabase.storage.from_.return_value = mock_storage

    # 4. Mock Supabase Database insert
    mock_table = MagicMock()
    mock_table.insert.return_value.execute.return_value = MagicMock(data=[{"id": "resume-uuid-123"}])
    mock_supabase.table.return_value = mock_table

    # 5. Mock ChromaDB embedding response
    mock_embed.return_value = 3 # 3 chunks indexed

    response = client.post(
        "/api/resume/upload",
        files={"file": ("resume.pdf", b"%PDF-1.4 dummy pdf bytes", "application/pdf")}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["file_url"] == "https://supabase.co/storage/john_doe.pdf"
    assert data["parsed_content"]["name"] == "John Doe"
    assert data["parsed_content"]["file_name"] == "resume.pdf"
    assert data["parsed_content"]["skills"] == ["Python", "FastAPI", "React"]
    assert data["chunks_indexed"] == 3

    # Check that storage upload path includes the filename
    called_args, called_kwargs = mock_storage.upload.call_args
    assert "resume.pdf" in called_kwargs["path"]


@patch("app.api.routes.resume.supabase_admin")
def test_get_my_resumes_success(mock_supabase):
    """
    Test retrieving all resumes for the authenticated user.
    """
    mock_user = MagicMock()
    mock_user.id = "user-uuid-12345"
    app.dependency_overrides[get_current_user] = lambda: mock_user

    mock_resumes_list = [
        {
            "id": "resume-1",
            "file_url": "url-1",
            "parsed_content": {"name": "John"},
            "created_at": "2026-06-11T00:00:00"
        }
    ]
    mock_table = MagicMock()
    mock_table.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=mock_resumes_list)
    mock_supabase.table.return_value = mock_table

    response = client.get("/api/resume/my")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == "resume-1"


@patch("app.api.routes.resume.supabase_admin")
def test_delete_resume_with_filename(mock_supabase):
    """
    Test deleting a resume that has file_name in parsed_content.
    """
    mock_user = MagicMock()
    mock_user.id = "user-uuid-12345"
    app.dependency_overrides[get_current_user] = lambda: mock_user

    # Mock select response returning file_name in parsed_content
    mock_table = MagicMock()
    mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[
        {
            "id": "resume-uuid-123",
            "file_url": "https://supabase.co/storage/resume.pdf",
            "parsed_content": {
                "name": "John Doe",
                "file_name": "original_resume_name.pdf"
            }
        }
    ])
    
    # Mock delete response
    mock_table.delete.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    mock_supabase.table.return_value = mock_table

    # Mock Supabase Storage remove method
    mock_storage = MagicMock()
    mock_storage.remove.return_value = {}
    mock_supabase.storage.from_.return_value = mock_storage

    response = client.delete("/api/resume/resume-uuid-123")
    assert response.status_code == 200
    
    # Verify we removed the file using the original filename path
    expected_path = "user-uuid-12345/resume-uuid-123/original_resume_name.pdf"
    mock_storage.remove.assert_called_once_with([expected_path])


@patch("app.api.routes.resume.supabase_admin")
def test_delete_resume_legacy(mock_supabase):
    """
    Test deleting a legacy resume that does NOT have file_name in parsed_content.
    """
    mock_user = MagicMock()
    mock_user.id = "user-uuid-12345"
    app.dependency_overrides[get_current_user] = lambda: mock_user

    # Mock select response returning parsed_content without file_name
    mock_table = MagicMock()
    mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[
        {
            "id": "resume-uuid-123",
            "file_url": "https://supabase.co/storage/resume.pdf",
            "parsed_content": {
                "name": "John Doe"
            }
        }
    ])
    
    # Mock delete response
    mock_table.delete.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    mock_supabase.table.return_value = mock_table

    # Mock Supabase Storage remove method
    mock_storage = MagicMock()
    mock_storage.remove.return_value = {}
    mock_supabase.storage.from_.return_value = mock_storage

    response = client.delete("/api/resume/resume-uuid-123")
    assert response.status_code == 200
    
    # Verify we removed the file using the legacy path
    expected_path = "user-uuid-12345/resume-uuid-123.pdf"
    mock_storage.remove.assert_called_once_with([expected_path])
