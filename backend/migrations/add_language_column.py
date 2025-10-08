"""
Database migration: Add language column to audio_files table.

This migration adds support for multi-language transcription by adding
a language column to store ISO 639-1 language codes (e.g., 'en', 'fi', 'sv').

⚠️  NOTE: This migration has been INCORPORATED into the main AudioFile model.
    For new installations, this script is NOT needed - the field is created
    automatically via SQLAlchemy models. This file is kept for rollback purposes.
    
    See: backend/app/models/audio_file.py line 34

Run this manually if upgrading from a version without language support:
    docker-compose exec backend python migrations/add_language_column.py
"""
import sqlite3
import sys
from pathlib import Path

# Database path (matches config.py default)
DB_PATH = "./data/transcriptions.db"


def migrate():
    """Add language column to audio_files table if it doesn't exist."""
    if not Path(DB_PATH).exists():
        print(f"✗ Database not found at {DB_PATH}")
        print("  This is normal for a fresh installation.")
        return False

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(audio_files)")
        columns = [row[1] for row in cursor.fetchall()]

        if "language" in columns:
            print("✓ Language column already exists, no migration needed")
            return True

        # Add the column
        print("Adding language column to audio_files table...")
        cursor.execute("ALTER TABLE audio_files ADD COLUMN language VARCHAR(10)")
        conn.commit()
        print("✓ Language column added successfully")
        return True

    except sqlite3.OperationalError as e:
        print(f"✗ Migration failed: {e}")
        return False

    finally:
        conn.close()


if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)
