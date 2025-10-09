"""
Database connection and session management.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from .config import settings
from ..models.base import Base


# Create database engine
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=settings.DEBUG,
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency to get database session.

    Yields:
        Session: SQLAlchemy database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Initialize database tables with complete schema.
    
    Creates all tables defined in the SQLAlchemy models with the latest schema.
    All historical schema changes have been incorporated directly into the model
    definitions, ensuring a clean, complete database structure on first run.
    
    For development: This approach eliminates migration complexity since we can
    recreate the database as needed. For production, consider using Alembic
    migrations for safer schema evolution.
    """
    Base.metadata.create_all(bind=engine)
