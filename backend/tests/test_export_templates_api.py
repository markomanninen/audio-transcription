from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import models

def test_create_export_template(client: TestClient):
    template_data = {
        "name": "My Custom Template",
        "description": "A template for blog posts.",
        "content": "Title: {{ title }}\\n\\n{{ content }}"
    }
    response = client.post("/api/export-templates/", json=template_data)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == template_data["name"]
    assert data["content"] == template_data["content"]
    assert "id" in data

def test_list_export_templates(client: TestClient, test_db: Session):
    # Create a template first
    template = models.ExportTemplate(name="List Test", content="content")
    test_db.add(template)
    test_db.commit()

    response = client.get("/api/export-templates/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert any(t["name"] == "List Test" for t in data)

def test_get_export_template(client: TestClient, test_db: Session):
    template = models.ExportTemplate(name="Get Test", content="content")
    test_db.add(template)
    test_db.commit()
    test_db.refresh(template)

    response = client.get(f"/api/export-templates/{template.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == template.id
    assert data["name"] == "Get Test"

def test_update_export_template(client: TestClient, test_db: Session):
    template = models.ExportTemplate(name="Update Test", content="initial")
    test_db.add(template)
    test_db.commit()
    test_db.refresh(template)

    update_data = {
        "name": "Updated Name",
        "description": "Updated desc",
        "content": "updated content"
    }
    response = client.put(f"/api/export-templates/{template.id}", json=update_data)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["description"] == "Updated desc"

def test_delete_export_template(client: TestClient, test_db: Session):
    template = models.ExportTemplate(name="Delete Test", content="to be deleted")
    test_db.add(template)
    test_db.commit()
    test_db.refresh(template)

    response = client.delete(f"/api/export-templates/{template.id}")
    assert response.status_code == 204

    # Verify it's gone
    response = client.get(f"/api/export-templates/{template.id}")
    assert response.status_code == 404