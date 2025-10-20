"""
Database connection and session management.
"""
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
from typing import Generator

from .config import settings
from ..models.base import Base


# Create database engine - use NullPool for SQLite to avoid connection issues
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    poolclass=NullPool if "sqlite" in settings.DATABASE_URL else None,
    echo=settings.DEBUG,
)

# Set SQLite pragmas on connection
if "sqlite" in settings.DATABASE_URL:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()

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
    except Exception:
        # Rollback on any exception to prevent hanging transactions
        db.rollback()
        raise
    finally:
        # Always close the session to release the connection
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

    Note: SQLite WAL mode and pragmas are set automatically via connection event listener.
    """
    Base.metadata.create_all(bind=engine)

    # Ensure new columns exist on legacy databases (development convenience).
    try:
        inspector = inspect(engine)
        with engine.begin() as conn:
            segment_columns = {col["name"] for col in inspector.get_columns("segments")}
            if "is_passive" not in segment_columns:
                conn.execute(
                    text("ALTER TABLE segments ADD COLUMN is_passive BOOLEAN NOT NULL DEFAULT 0")
                )

            audio_columns = {col["name"] for col in inspector.get_columns("audio_files")}
            if "parent_audio_file_id" not in audio_columns:
                conn.execute(
                    text("ALTER TABLE audio_files ADD COLUMN parent_audio_file_id INTEGER")
                )
            if "split_start_seconds" not in audio_columns:
                conn.execute(
                    text("ALTER TABLE audio_files ADD COLUMN split_start_seconds FLOAT")
                )
            if "split_end_seconds" not in audio_columns:
                conn.execute(
                    text("ALTER TABLE audio_files ADD COLUMN split_end_seconds FLOAT")
                )
            if "split_depth" not in audio_columns:
                conn.execute(
                    text("ALTER TABLE audio_files ADD COLUMN split_depth INTEGER NOT NULL DEFAULT 0")
                )
            if "split_order" not in audio_columns:
                conn.execute(
                    text("ALTER TABLE audio_files ADD COLUMN split_order INTEGER NOT NULL DEFAULT 0")
                )
    except Exception:
        # Do not block application startup if inspection fails (e.g., table missing)
        pass
