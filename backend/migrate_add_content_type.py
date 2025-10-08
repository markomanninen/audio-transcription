"""
Migration script to add content_type column to projects table.

⚠️  NOTE: This migration has been INCORPORATED into the main Project model.
    For new installations, this script is NOT needed - the field is created
    automatically via SQLAlchemy models. This file is kept for rollback purposes.
    
    See: backend/app/models/project.py lines 17-21
"""
import sqlite3

# Connect to database
conn = sqlite3.connect('/app/data/transcriptions.db')
cursor = conn.cursor()

try:
    # Add content_type column
    cursor.execute("""
        ALTER TABLE projects
        ADD COLUMN content_type VARCHAR(50) DEFAULT 'general'
    """)
    conn.commit()
    print("✅ Successfully added content_type column to projects table")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e).lower():
        print("⚠️ Column content_type already exists")
    else:
        print(f"❌ Error: {e}")
finally:
    conn.close()
