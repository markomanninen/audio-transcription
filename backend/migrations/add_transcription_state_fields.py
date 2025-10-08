#!/usr/bin/env python3
"""
Add comprehensive transcription state tracking fields.
"""

import sys
import os

# Add the parent directory to Python path to import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import text
from app.core.database import engine

def add_transcription_state_fields():
    """Add fields for comprehensive transcription state tracking."""
    
    migrations = [
        # Add fields for audio processing state
        """
        ALTER TABLE audio_files 
        ADD COLUMN audio_transformed BOOLEAN DEFAULT FALSE;
        """,
        
        """
        ALTER TABLE audio_files 
        ADD COLUMN audio_transformation_path TEXT NULL;
        """,
        
        """
        ALTER TABLE audio_files 
        ADD COLUMN whisper_model_loaded TEXT NULL;
        """,
        
        """
        ALTER TABLE audio_files 
        ADD COLUMN transcription_stage TEXT DEFAULT 'pending';
        """,
        
        """
        ALTER TABLE audio_files 
        ADD COLUMN last_processed_segment INTEGER DEFAULT 0;
        """,
        
        """
        ALTER TABLE audio_files 
        ADD COLUMN processing_checkpoint TEXT NULL;
        """,
        
        """
        ALTER TABLE audio_files 
        ADD COLUMN resume_token TEXT NULL;
        """,
        
        """
        ALTER TABLE audio_files 
        ADD COLUMN transcription_metadata TEXT NULL;
        """,
        
        """
        ALTER TABLE audio_files 
        ADD COLUMN interruption_count INTEGER DEFAULT 0;
        """,
        
        """
        ALTER TABLE audio_files 
        ADD COLUMN last_error_at TIMESTAMP NULL;
        """,
        
        """
        ALTER TABLE audio_files 
        ADD COLUMN recovery_attempts INTEGER DEFAULT 0;
        """
    ]
    
    with engine.connect() as conn:
        for migration in migrations:
            try:
                print(f"Executing: {migration.strip()}")
                conn.execute(text(migration))
                conn.commit()
                print("✅ Success")
            except Exception as e:
                if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                    print(f"⚠️  Column already exists, skipping")
                else:
                    print(f"❌ Error: {e}")
                    raise

if __name__ == "__main__":
    print("Adding comprehensive transcription state tracking fields...")
    add_transcription_state_fields()
    print("Migration completed!")