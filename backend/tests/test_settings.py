"""
Unit tests for the user-controlled settings endpoints and key resolution utility.
Mocks Supabase database interactions to ensure formatting rules, masking, and resolution priorities.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

from app.main import app
from app.api.routes.auth import get_current_user
from app.api.routes.settings import resolve_api_key, mask_api_key

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    """
    Reset overrides before/after each test.
    """
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def test_mask_api_key():
    """
    Verify API key masking logic.
    """
    assert mask_api_key("sk-abcdefgh12345678") == "sk-abc...5678"
    assert mask_api_key("short") == "****"


@patch("app.api.routes.settings.supabase_admin")
def test_get_api_keys_success(mock_supabase):
    """
    Verify GET /settings/keys retrieves and masks stored keys.
    """
    # 1. Mock auth
    mock_user = MagicMock()
    mock_user.id = "user-123"
    app.dependency_overrides[get_current_user] = lambda: mock_user

    # 2. Mock database query returning OpenAI key
    mock_table = MagicMock()
    mock_table.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"provider": "openai", "api_key": "sk-mysecretkey123"}]
    )
    mock_supabase.table.return_value = mock_table

    # 3. Call endpoint
    response = client.get("/api/settings/keys")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data) == 3 # openai, anthropic, google
    
    openai_status = next(item for item in data if item["provider"] == "openai")
    assert openai_status["has_key"] is True
    assert openai_status["masked_key"] == "sk-mys...y123"

    anthropic_status = next(item for item in data if item["provider"] == "anthropic")
    assert anthropic_status["has_key"] is False
    assert anthropic_status["masked_key"] == ""


@patch("app.api.routes.settings.supabase_admin")
def test_save_api_key_validation(mock_supabase):
    """
    Verify POST /settings/keys performs validation checks.
    """
    # Mock auth
    mock_user = MagicMock()
    mock_user.id = "user-123"
    app.dependency_overrides[get_current_user] = lambda: mock_user

    # Test invalid provider
    response = client.post(
        "/api/settings/keys",
        json={"provider": "invalid_provider", "api_key": "sk-123"}
    )
    assert response.status_code == 400
    assert "Unsupported provider" in response.json()["detail"]

    # Test invalid OpenAI format (missing sk-)
    response = client.post(
        "/api/settings/keys",
        json={"provider": "openai", "api_key": "badformatkey"}
    )
    assert response.status_code == 400
    assert "Invalid OpenAI API Key format" in response.json()["detail"]

    # Test invalid Anthropic format (missing sk-ant-)
    response = client.post(
        "/api/settings/keys",
        json={"provider": "anthropic", "api_key": "sk-badformat"}
    )
    assert response.status_code == 400
    assert "Invalid Anthropic API Key format" in response.json()["detail"]


@patch("app.api.routes.settings.supabase_admin")
def test_save_api_key_success(mock_supabase):
    """
    Verify POST /settings/keys updates database on valid input.
    """
    # Mock auth
    mock_user = MagicMock()
    mock_user.id = "user-123"
    app.dependency_overrides[get_current_user] = lambda: mock_user

    # Mock database upsert
    mock_table = MagicMock()
    mock_table.upsert.return_value.execute.return_value = MagicMock(data=[{}])
    mock_supabase.table.return_value = mock_table

    response = client.post(
        "/api/settings/keys",
        json={"provider": "openai", "api_key": "sk-validkey123456"}
    )
    assert response.status_code == 200
    assert "Successfully updated" in response.json()["detail"]


@patch("app.api.routes.settings.supabase_admin")
def test_resolve_api_key_db_priority(mock_supabase):
    """
    Verify resolve_api_key resolves key from DB if it exists.
    """
    mock_table = MagicMock()
    mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"api_key": "sk-dbkey123456"}]
    )
    mock_supabase.table.return_value = mock_table

    # Should resolve key from DB
    resolved = resolve_api_key("user-123", "openai")
    assert resolved == "sk-dbkey123456"


@patch("app.api.routes.settings.supabase_admin")
@patch("app.api.routes.settings.settings")
def test_resolve_api_key_fallback_settings(mock_settings, mock_supabase):
    """
    Verify resolve_api_key falls back to settings if not in DB.
    """
    # DB empty
    mock_table = MagicMock()
    mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[]
    )
    mock_supabase.table.return_value = mock_table

    # Mock settings
    mock_settings.OPENAI_API_KEY = "sk-settingskey12345"

    resolved = resolve_api_key("user-123", "openai")
    assert resolved == "sk-settingskey12345"


@patch("app.api.routes.settings.supabase_admin")
@patch("app.api.routes.settings.settings")
def test_resolve_api_key_missing_raises_http_error(mock_settings, mock_supabase):
    """
    Verify resolve_api_key raises HTTP 400 if key is completely missing.
    """
    # DB empty
    mock_table = MagicMock()
    mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[]
    )
    mock_supabase.table.return_value = mock_table

    # Settings has dummy or None
    mock_settings.OPENAI_API_KEY = "dummy-key"

    with pytest.raises(HTTPException) as exc_info:
        resolve_api_key("user-123", "openai")
    
    assert exc_info.value.status_code == 400
    assert "Missing OpenAI API Key" in exc_info.value.detail
