"""
Backend authentication and health check unit tests.
Uses FastAPI TestClient to verify API routing and schema validation.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    """
    Test that the health endpoint returns 200 OK and correct JSON.
    """
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert "project" in response.json()


def test_login_validation_error():
    """
    Test that the login endpoint returns 422 Unprocessable Entity
    when given incorrect request body schemas.
    """
    # Missing email
    response = client.post("/api/auth/login", json={"password": "password123"})
    assert response.status_code == 422

    # Invalid email format
    response = client.post("/api/auth/login", json={"email": "invalid-email", "password": "password123"})
    assert response.status_code == 422


def test_register_validation_error():
    """
    Test that the registration endpoint returns 422 Unprocessable Entity
    when invalid inputs are provided (e.g. password too short, invalid email).
    """
    # Password too short (requires min 6 characters in Pydantic schema)
    response = client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "123",
        "full_name": "Test User"
    })
    assert response.status_code == 422

    # Invalid email
    response = client.post("/api/auth/register", json={
        "email": "not-an-email",
        "password": "password123",
        "full_name": "Test User"
    })
    assert response.status_code == 422


def test_protected_me_endpoint_unauthorized():
    """
    Test that calling /auth/me without a Bearer token returns 401 Unauthorized.
    """
    response = client.get("/api/auth/me")
    assert response.status_code == 401
