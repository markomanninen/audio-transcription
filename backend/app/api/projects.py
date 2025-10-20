"""
API endpoints for managing projects, including text-based projects.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from typing import Optional, List

from .. import models
from ..core.database import get_db

router = APIRouter(prefix="/api/projects", tags=["Projects"])

class TextProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    content: Optional[str] = ""

class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    project_type: str

class TextDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    content: str
    history: str

class FullProjectResponse(ProjectResponse):
    text_document: Optional[TextDocumentResponse] = None

@router.get("/", response_model=List[ProjectResponse])
def list_projects(db: Session = Depends(get_db)):
    """
    List all projects.
    """
    projects = db.query(models.Project).order_by(models.Project.updated_at.desc()).all()
    return projects

@router.post("/text", response_model=ProjectResponse, status_code=201)
def create_text_project(project_data: TextProjectCreate, db: Session = Depends(get_db)):
    """
    Create a new text-based project.
    """
    new_project = models.Project(
        name=project_data.name,
        description=project_data.description,
        project_type="text"
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    text_document = models.TextDocument(
        project_id=new_project.id,
        content=project_data.content or ""
    )
    db.add(text_document)
    db.commit()

    return new_project


@router.get("/{project_id}", response_model=FullProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """
    Get a project's details, including the text document if it's a text project.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return project