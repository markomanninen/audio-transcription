#!/usr/bin/env python3
"""
Migration script to add audit fields to audio_files table.
Adds performance tracking fields for transcription monitoring.

⚠️  NOTE: This migration has been INCORPORATED into the main AudioFile model.
    For new installations, this script is NOT needed - the fields are created
    automatically via SQLAlchemy models. This file is kept for rollback purposes.
    
    See: backend/app/models/audio_file.py lines 43-47
"""

import sqlite3
import sys
import os


def main():
    """Add audit fields to audio_files table."""
    # Database is in the data directory
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(backend_dir, "data", "transcriptions.db")

    if not os.path.exists(db_path):
        print(f"Database not found: {db_path}")
        print("Please ensure the database has been created.")
        sys.exit(1)

    print(f"Adding audit fields to database: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if audit fields already exist
        cursor.execute("PRAGMA table_info(audio_files)")
        columns = [column[1] for column in cursor.fetchall()]
        
        audit_fields = [
            ("transcription_started_at", "DATETIME"),
            ("transcription_completed_at", "DATETIME"), 
            ("transcription_duration_seconds", "REAL"),
            ("model_used", "VARCHAR(50)"),
            ("processing_stats", "TEXT")
        ]
        
        # Add missing audit fields
        for field_name, field_type in audit_fields:
            if field_name not in columns:
                sql = f"ALTER TABLE audio_files ADD COLUMN {field_name} {field_type}"
                print(f"Adding column: {field_name} ({field_type})")
                cursor.execute(sql)
            else:
                print(f"Column already exists: {field_name}")
        
        conn.commit()
        print("✅ Audit fields migration completed successfully!")
        
        # Show updated table structure
        cursor.execute("PRAGMA table_info(audio_files)")
        columns = cursor.fetchall()
        print("\nUpdated audio_files table structure:")
        for column in columns:
            print(f"  {column[1]} {column[2]}")
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    main()