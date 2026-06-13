"""
Unit tests for the job matching and analysis endpoints.
Mocks external calls to Supabase, OpenAI, LangChain, and ChromaDB to ensure isolated logic testing.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.api.routes.auth import get_current_user
from app.chains.ats_chain import ATSScoreReport
from app.chains.skill_gap_chain import SkillGapReport
from app.chains.roadmap_chain import StudyRoadmap, WeeklyModule, ResourceItem

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    """
    Clear dependencies before and after each test.
    """
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def test_compare_unauthorized():
    """
    Test that calling compare without an auth token returns 401.
    """
    response = client.post(
        "/api/analysis/compare",
        json={
            "resume_id": "resume-123",
            "jd_text": "Need python engineer"
        }
    )
    assert response.status_code == 401


def test_compare_empty_jd():
    """
    Test that posting an empty job description returns 400 Bad Request.
    """
    mock_user = MagicMock()
    mock_user.id = "user-123"
    app.dependency_overrides[get_current_user] = lambda: mock_user

    response = client.post(
        "/api/analysis/compare",
        json={
            "resume_id": "resume-123",
            "jd_text": ""
        }
    )
    assert response.status_code == 400
    assert "cannot be empty" in response.json()["detail"]


@patch("app.api.routes.analysis.supabase_admin")
@patch("app.api.routes.analysis.get_ats_score_chain")
@patch("app.api.routes.analysis.get_skill_gap_chain")
@patch("app.api.routes.analysis.get_resume_jd_similarity")
def test_compare_success(mock_similarity, mock_gap_chain, mock_ats_chain, mock_supabase):
    """
    Test successful resume-JD comparison, ensuring correct mathematical scoring,
    PostgreSQL saves, and response payload formatting.
    """
    # 1. Mock auth
    mock_user = MagicMock()
    mock_user.id = "user-123"
    app.dependency_overrides[get_current_user] = lambda: mock_user

    # 2. Mock database retrieve (getting raw resume text)
    mock_table = MagicMock()
    mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"raw_text": "Experienced Python Developer with FastAPI skills."}]
    )
    mock_supabase.table.return_value = mock_table

    # 3. Mock LangChain ATS score execution
    mock_ats_report = ATSScoreReport(
        score=85,
        explanation="Highly aligned technical profile."
    )
    mock_ats_invoker = MagicMock()
    mock_ats_invoker.invoke.return_value = mock_ats_report
    mock_ats_chain.return_value = mock_ats_invoker

    # 4. Mock LangChain Skill Gap execution
    mock_gap_report = SkillGapReport(
        missing_skills=["Kubernetes", "AWS"],
        matched_skills=["Python", "FastAPI"],
        suggestions=["Detail deployment strategies in project descriptions."]
    )
    mock_gap_invoker = MagicMock()
    mock_gap_invoker.invoke.return_value = mock_gap_report
    mock_gap_chain.return_value = mock_gap_invoker

    # 5. Mock Vector Cosine Similarity score from ChromaDB
    # returns 0.90 similarity (90%)
    mock_similarity.return_value = 0.90

    # 6. Mock Supabase DB saves (inserting JD and Analysis report)
    mock_table.insert.return_value.execute.return_value = MagicMock(data=[{"id": "analysis-123"}])

    response = client.post(
        "/api/analysis/compare",
        json={
            "resume_id": "resume-123",
            "jd_text": "Looking for python fastapi engineer with AWS and Kubernetes.",
            "title": "Senior Cloud Backend Engineer",
            "company": "DeepMind"
        }
    )

    # 7. Assertions
    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["ats_score"] == 85
    assert data["vector_score"] == 90
    # Match percentage calculations: (85 * 0.7) + (90 * 0.3) = 59.5 + 27 = 86.5 -> 86
    assert data["match_percentage"] == 86
    assert data["skill_gaps"]["missing_skills"] == ["Kubernetes", "AWS"]
    assert data["skill_gaps"]["matched_skills"] == ["Python", "FastAPI"]
    assert data["improvement_suggestions"] == ["Detail deployment strategies in project descriptions."]


@patch("app.api.routes.analysis.supabase_admin")
@patch("app.api.routes.analysis.get_roadmap_chain")
def test_generate_roadmap_success(mock_roadmap_chain, mock_supabase):
    """
    Test successful study roadmap generation and PostgreSQL caching behavior.
    """
    # 1. Mock auth
    mock_user = MagicMock()
    mock_user.id = "user-123"
    app.dependency_overrides[get_current_user] = lambda: mock_user

    # 2. Mock database retrieve (fetching analysis record with skill gaps)
    mock_analysis_data = [
        {
            "id": "analysis-123",
            "user_id": "user-123",
            "skill_gaps": {
                "missing_skills": ["Kubernetes", "AWS"]
            },
            "job_descriptions": {
                "title": "Cloud Engineer"
            },
            "roadmap": None  # Not generated yet
        }
    ]
    mock_table = MagicMock()
    mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=mock_analysis_data)
    mock_supabase.table.return_value = mock_table

    # 3. Mock LangChain Roadmap execution
    mock_roadmap = StudyRoadmap(
        duration_weeks=4,
        target_role="Cloud Engineer",
        weeks=[
            WeeklyModule(
                week_number=1,
                title="Intro to AWS",
                description="AWS cloud fundamentals",
                topics=["S3", "EC2"],
                resources=[
                    ResourceItem(name="AWS Docs", url="https://aws.amazon.com", category="documentation")
                ]
            )
        ]
    )
    mock_invoker = MagicMock()
    mock_invoker.invoke.return_value = mock_roadmap
    mock_roadmap_chain.return_value = mock_invoker

    # 4. Mock database update
    mock_table.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{}])

    # 5. Call API
    response = client.post("/api/analysis/analysis-123/roadmap")

    # 6. Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["duration_weeks"] == 4
    assert data["target_role"] == "Cloud Engineer"
    assert len(data["weeks"]) == 1
    assert data["weeks"][0]["title"] == "Intro to AWS"
    assert data["weeks"][0]["resources"][0]["url"] == "https://aws.amazon.com"


@patch("app.api.routes.analysis.supabase_admin")
def test_delete_roadmap_success(mock_supabase):
    """
    Test that deleting a roadmap sets the roadmap column to None in Supabase.
    """
    # 1. Mock auth
    mock_user = MagicMock()
    mock_user.id = "user-123"
    app.dependency_overrides[get_current_user] = lambda: mock_user

    # 2. Mock database update
    mock_table = MagicMock()
    mock_table.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"id": "analysis-123", "roadmap": None}]
    )
    mock_supabase.table.return_value = mock_table

    # 3. Call API
    response = client.delete("/api/analysis/analysis-123/roadmap")

    # 4. Assertions
    assert response.status_code == 200
    assert response.json()["detail"] == "Successfully deleted the learning roadmap."
    mock_table.update.assert_called_once_with({"roadmap": None})


