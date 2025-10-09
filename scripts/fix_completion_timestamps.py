#!/usr/bin/env python3
"""
Fix completion timestamps for files that have segments but no completion timestamp.
Run this script to fix existing database records after the bug fix.
"""
import sys
sys.path.insert(0, '/app')

from app.core.database import SessionLocal
from app.models.audio_file import AudioFile, TranscriptionStatus
from app.models.segment import Segment
from datetime import datetime
from sqlalchemy import func

def fix_completion_timestamps():
    db = SessionLocal()
    try:
        # Find all files with segments but no completion timestamp
        files_with_segments = db.query(AudioFile).join(Segment).group_by(AudioFile.id).having(func.count(Segment.id) > 0).all()

        fixed_count = 0
        for audio_file in files_with_segments:
            segment_count = db.query(Segment).filter(Segment.audio_file_id == audio_file.id).count()

            print(f"Checking file {audio_file.id}: {audio_file.original_filename}")
            print(f"  - Segments: {segment_count}")
            print(f"  - Status: {audio_file.transcription_status}")
            print(f"  - Completed at: {audio_file.transcription_completed_at}")

            if segment_count > 0:
                # File has segments - should be marked as completed
                if not audio_file.transcription_completed_at or audio_file.transcription_status != TranscriptionStatus.COMPLETED:
                    print(f"Fixing file {audio_file.id}: {audio_file.original_filename}")
                    print(f"  - Segments: {segment_count}")
                    print(f"  - Old status: {audio_file.transcription_status}")
                    print(f"  - Old completed_at: {audio_file.transcription_completed_at}")

                    audio_file.transcription_status = TranscriptionStatus.COMPLETED
                    audio_file.transcription_progress = 1.0
                    audio_file.error_message = None

                    # Set completion timestamp to created_at of last segment or current time
                    if not audio_file.transcription_completed_at:
                        last_segment = db.query(Segment).filter(
                            Segment.audio_file_id == audio_file.id
                        ).order_by(Segment.created_at.desc()).first()

                        if last_segment and last_segment.created_at:
                            audio_file.transcription_completed_at = last_segment.created_at
                        else:
                            audio_file.transcription_completed_at = datetime.utcnow()

                    print(f"  - New status: {audio_file.transcription_status}")
                    print(f"  - New completed_at: {audio_file.transcription_completed_at}")
                    print()

                    fixed_count += 1

        db.commit()
        print(f"Fixed {fixed_count} files")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_completion_timestamps()
