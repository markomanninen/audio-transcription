"""
Migration Files - Status and Usage Guide
=========================================

This directory contains database migration scripts that have been used to evolve
the database schema over time. As of the current version, ALL CHANGES FROM THESE
MIGRATION FILES HAVE BEEN INCORPORATED into the main SQLAlchemy model definitions.

Current Status:
--------------
✅ add_audit_fields.py - Fields incorporated into AudioFile model (lines 43-47)
✅ add_language_column.py - Field incorporated into AudioFile model (line 34) 
✅ add_transcription_state_fields.py - Fields incorporated into AudioFile model (lines 49-58)
✅ ../migrate_add_content_type.py - Field incorporated into Project model (line 17-21)

For New Installations:
---------------------
- These migration files are NOT needed for fresh installations
- The main models in app/models/ contain the latest schema
- Database tables are created via SQLAlchemy's create_all() in app/core/database.py

For Existing Databases:
----------------------
- These files can be run manually if upgrading from older versions
- Each script is idempotent (safe to run multiple times)
- They check for existing columns before adding new ones

For Rollbacks:
-------------
- Keep these files for potential rollback scenarios
- They document the evolution of the database schema
- Useful for understanding what fields were added when

Migration Incorporated Fields:
-----------------------------

AudioFile Model:
- language: VARCHAR(10) - ISO 639-1 language codes
- transcription_started_at: DATETIME - When transcription began
- transcription_completed_at: DATETIME - When transcription finished  
- transcription_duration_seconds: REAL - Processing time
- model_used: VARCHAR(50) - Whisper model used
- processing_stats: TEXT - JSON performance metrics
- audio_transformed: BOOLEAN - Audio preprocessing status
- audio_transformation_path: TEXT - Path to transformed audio
- whisper_model_loaded: TEXT - Currently loaded model
- transcription_stage: TEXT - Current processing stage
- last_processed_segment: INTEGER - Last completed segment
- processing_checkpoint: TEXT - JSON checkpoint data
- resume_token: TEXT - Resume operation token
- transcription_metadata: TEXT - JSON transcription metadata
- interruption_count: INTEGER - Number of interruptions
- last_error_at: DATETIME - Last error timestamp
- recovery_attempts: INTEGER - Recovery attempt count

Project Model:
- content_type: VARCHAR(50) - Content type classification

Usage:
------
# For fresh installation (automatic via main app):
docker-compose up  # Tables created via SQLAlchemy models

# For manual migration (if needed):
docker-compose exec backend python migrations/add_audit_fields.py
docker-compose exec backend python migrations/add_language_column.py  
docker-compose exec backend python migrations/add_transcription_state_fields.py
docker-compose exec backend python migrate_add_content_type.py
"""