"""
API endpoints for managing export templates.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from typing import List, Optional

from .. import models
from ..core.database import get_db

router = APIRouter(prefix="/api/export-templates", tags=["Export Templates"])

class ExportTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    content: str

class ExportTemplateCreate(ExportTemplateBase):
    pass

class ExportTemplateUpdate(ExportTemplateBase):
    pass

class ExportTemplateResponse(ExportTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int

@router.post("/", response_model=ExportTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_export_template(template_data: ExportTemplateCreate, db: Session = Depends(get_db)):
    """
    Create a new export template.
    """
    new_template = models.ExportTemplate(**template_data.dict())
    db.add(new_template)
    try:
        db.commit()
        db.refresh(new_template)
        return new_template
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Template with this name already exists.")

@router.get("/", response_model=List[ExportTemplateResponse])
def list_export_templates(db: Session = Depends(get_db)):
    """
    List all export templates.
    """
    templates = db.query(models.ExportTemplate).order_by(models.ExportTemplate.name).all()
    return templates

@router.get("/{template_id}", response_model=ExportTemplateResponse)
def get_export_template(template_id: int, db: Session = Depends(get_db)):
    """
    Get a single export template by ID.
    """
    template = db.query(models.ExportTemplate).filter(models.ExportTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.put("/{template_id}", response_model=ExportTemplateResponse)
def update_export_template(template_id: int, template_data: ExportTemplateUpdate, db: Session = Depends(get_db)):
    """
    Update an export template.
    """
    template = db.query(models.ExportTemplate).filter(models.ExportTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    for key, value in template_data.dict().items():
        setattr(template, key, value)

    try:
        db.commit()
        db.refresh(template)
        return template
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Template with this name already exists.")

@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_export_template(template_id: int, db: Session = Depends(get_db)):
    """
    Delete an export template.
    """
    template = db.query(models.ExportTemplate).filter(models.ExportTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    db.delete(template)
    db.commit()
    return