from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import models

def test_create_text_project(client: TestClient, test_db: Session):
    """
    Test creating a new text-based project.
    """
    project_data = {
        "name": "My First Text Project",
        "description": "A project for creative writing.",
        "content": "Once upon a time..."
    }
    response = client.post("/api/projects/text", json=project_data)

    assert response.status_code == 201

    data = response.json()
    assert data["name"] == project_data["name"]
    assert data["project_type"] == "text"

    # Verify in DB
    project_in_db = test_db.query(models.Project).filter(models.Project.id == data["id"]).first()
    assert project_in_db is not None
    assert project_in_db.name == project_data["name"]
    assert project_in_db.project_type == "text"

    text_doc = test_db.query(models.TextDocument).filter(models.TextDocument.project_id == project_in_db.id).first()
    assert text_doc is not None
    assert text_doc.content == project_data["content"]


def test_get_text_project(client: TestClient, test_db: Session):
    """
    Test retrieving a text-based project by its ID.
    """
    # First, create a project to retrieve
    project = models.Project(name="Test Project", project_type="text")
    test_db.add(project)
    test_db.commit()
    test_db.refresh(project)

    text_doc = models.TextDocument(project_id=project.id, content="Initial content.")
    test_db.add(text_doc)
    test_db.commit()

    response = client.get(f"/api/projects/{project.id}")

    assert response.status_code == 200

    data = response.json()
    assert data["id"] == project.id
    assert data["name"] == project.name
    assert data["project_type"] == "text"
    assert data["text_document"] is not None
    assert data["text_document"]["content"] == "Initial content."

def test_get_project_not_found(client: TestClient):
    """
    Test retrieving a non-existent project.
    """
    response = client.get("/api/projects/9999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"