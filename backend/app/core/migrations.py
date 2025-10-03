"""
Automatic database migrations on startup.

This module checks and applies necessary database schema changes automatically
when the application starts, ensuring smooth upgrades without manual intervention.
"""
import sqlite3
import logging
from pathlib import Path
from .config import settings

logger = logging.getLogger(__name__)


def get_db_path() -> str:
    """Extract the database file path from DATABASE_URL."""
    # Format: sqlite:///./data/transcriptions.db
    db_url = settings.DATABASE_URL
    if db_url.startswith("sqlite:///"):
        path = db_url.replace("sqlite:///", "")
        return path
    return "./data/transcriptions.db"  # fallback


def check_and_add_language_column():
    """Add language column to audio_files table if it doesn't exist."""
    db_path = get_db_path()

    if not Path(db_path).exists():
        logger.info("Database doesn't exist yet, will be created on first use")
        return

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if column exists
        cursor.execute("PRAGMA table_info(audio_files)")
        columns = [row[1] for row in cursor.fetchall()]

        if "language" not in columns:
            logger.info("Adding language column to audio_files table...")
            cursor.execute("ALTER TABLE audio_files ADD COLUMN language VARCHAR(10)")
            conn.commit()
            logger.info("✓ Language column added successfully")
        else:
            logger.debug("Language column already exists")

        conn.close()

    except Exception as e:
        logger.error(f"Failed to check/add language column: {e}")
        # Don't fail startup, just log the error
        # The actual error will occur when trying to query the column


def check_and_create_llm_logs_table():
    """Create llm_logs table if it doesn't exist."""
    db_path = get_db_path()

    if not Path(db_path).exists():
        return

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='llm_logs'")
        table_exists = cursor.fetchone() is not None

        if not table_exists:
            logger.info("Creating llm_logs table...")
            cursor.execute("""
                CREATE TABLE llm_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    provider VARCHAR(50) NOT NULL,
                    model VARCHAR(100) NOT NULL,
                    operation VARCHAR(50) NOT NULL,
                    prompt TEXT NOT NULL,
                    original_text TEXT,
                    context TEXT,
                    response TEXT NOT NULL,
                    corrected_text TEXT,
                    status VARCHAR(20) DEFAULT 'success',
                    error_message TEXT,
                    duration_ms FLOAT,
                    segment_id INTEGER,
                    project_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
            logger.info("✓ llm_logs table created successfully")
        else:
            logger.debug("llm_logs table already exists")

        conn.close()

    except Exception as e:
        logger.error(f"Failed to check/create llm_logs table: {e}")


def run_migrations():
    """Run all necessary database migrations."""
    logger.info("Checking database migrations...")
    check_and_add_language_column()
    check_and_create_llm_logs_table()
    logger.info("Database migrations check complete")
