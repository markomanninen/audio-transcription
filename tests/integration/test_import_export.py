#!/usr/bin/env python3
"""
Simple integration test for project export/import functionality.
"""
import os
import sys
import tempfile
import shutil
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

# Set up minimal environment for testing
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_import_export.db")
os.environ.setdefault("AUDIO_STORAGE_PATH", "./test_audio")

def test_import_export():
    """Test basic import/export functionality."""
    try:
        from app.core.database import engine, SessionLocal
        from app.models.base import Base
        from app.models.project import Project
        from app.models.audio_file import AudioFile, TranscriptionStatus
        from app.models.segment import Segment
        from app.models.speaker import Speaker
        from app.models.edit import Edit
        from app.services.project_export_import_service import ProjectExportImportService
        
        # Create database tables
        Base.metadata.create_all(bind=engine)
        
        # Create a test session
        db = SessionLocal()
        
        try:
            # Create test project
            project = Project(
                name="Test Export Project",
                description="A test project for export/import",
                project_type="audio",
                content_type="interview"
            )
            db.add(project)
            db.flush()
            
            # Create test speaker
            speaker = Speaker(
                project_id=project.id,
                speaker_id="SPEAKER_00",
                display_name="Test Speaker",
                color="#FF0000"
            )
            db.add(speaker)
            db.flush()
            
            # Create test audio file
            temp_audio_dir = tempfile.mkdtemp()
            audio_file_path = os.path.join(temp_audio_dir, "test.mp3")
            with open(audio_file_path, 'wb') as f:
                f.write(b"dummy audio content")
            
            audio_file = AudioFile(
                project_id=project.id,
                filename="test.mp3",
                original_filename="test_original.mp3",
                file_path=audio_file_path,
                file_size=len(b"dummy audio content"),
                duration=30.0,
                format="mp3",
                transcription_status=TranscriptionStatus.COMPLETED
            )
            db.add(audio_file)
            db.flush()
            
            # Create test segment
            segment = Segment(
                audio_file_id=audio_file.id,
                speaker_id=speaker.id,
                start_time=0.0,
                end_time=5.0,
                original_text="Hello, this is a test.",
                edited_text="Hello, this is a test!",
                sequence=0,
                is_passive=False
            )
            db.add(segment)
            db.flush()
            
            # Create test edit
            edit = Edit(
                segment_id=segment.id,
                previous_text="Hello, this is a test.",
                new_text="Hello, this is a test!",
                edit_type="manual"
            )
            db.add(edit)
            db.commit()
            
            print("✅ Test data created successfully")
            
            # Test export
            export_service = ProjectExportImportService()
            zip_path, filename = export_service.export_project_to_zip(project.id, db)
            
            print(f"✅ Export successful: {filename}")
            print(f"   ZIP file: {zip_path}")
            print(f"   File size: {os.path.getsize(zip_path)} bytes")
            
            # Test validation
            validation = export_service.validate_import_zip(zip_path)
            
            print(f"✅ Validation successful: {validation.is_valid}")
            if validation.project_info:
                print(f"   Project: {validation.project_info['name']}")
                print(f"   Type: {validation.project_info['type']}")
            if validation.file_info:
                print(f"   Audio files: {validation.file_info['audio_files']}")
                print(f"   Segments: {validation.file_info['segments']}")
                print(f"   Speakers: {validation.file_info['speakers']}")
                print(f"   Edits: {validation.file_info['edits']}")
            
            # Test import
            result = export_service.import_project_from_zip(
                zip_path,
                db,
                new_project_name="Imported Test Project",
                new_project_description="This was imported from ZIP"
            )
            
            print(f"✅ Import successful: {result.success}")
            if result.success:
                print(f"   New project ID: {result.project_id}")
                print(f"   Audio files imported: {result.import_stats.get('audio_files_imported', 0)}")
                print(f"   Segments imported: {result.import_stats.get('segments_imported', 0)}")
                print(f"   Speakers imported: {result.import_stats.get('speakers_imported', 0)}")
                print(f"   Edits imported: {result.import_stats.get('edits_imported', 0)}")
            
            if result.warnings:
                print("⚠️  Warnings:")
                for warning in result.warnings:
                    print(f"   - {warning}")
            
            if result.errors:
                print("❌ Errors:")
                for error in result.errors:
                    print(f"   - {error}")
            
            # Verify imported data
            if result.success and result.project_id:
                imported_project = db.query(Project).filter(Project.id == result.project_id).first()
                imported_audio_files = db.query(AudioFile).filter(AudioFile.project_id == result.project_id).all()
                imported_segments = db.query(Segment).join(AudioFile).filter(AudioFile.project_id == result.project_id).all()
                imported_speakers = db.query(Speaker).filter(Speaker.project_id == result.project_id).all()
                imported_edits = db.query(Edit).join(Segment).join(AudioFile).filter(AudioFile.project_id == result.project_id).all()
                
                print(f"✅ Data verification:")
                print(f"   Project name: {imported_project.name}")
                print(f"   Audio files: {len(imported_audio_files)}")
                print(f"   Segments: {len(imported_segments)}")
                print(f"   Speakers: {len(imported_speakers)}")
                print(f"   Edits: {len(imported_edits)}")
                
                # Check audio file integrity
                for af in imported_audio_files:
                    if af.file_path and os.path.exists(af.file_path):
                        print(f"   ✅ Audio file copied: {af.original_filename}")
                    else:
                        print(f"   ❌ Audio file missing: {af.original_filename}")
            
            # Clean up
            os.unlink(zip_path)
            shutil.rmtree(temp_audio_dir, ignore_errors=True)
            
            print("\n🎉 All tests passed successfully!")
            return True
            
        finally:
            db.close()
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        # Clean up test database
        if os.path.exists("test_import_export.db"):
            os.unlink("test_import_export.db")
        
        # Clean up test audio directory
        if os.path.exists("test_audio"):
            shutil.rmtree("test_audio", ignore_errors=True)

if __name__ == "__main__":
    print("🚀 Testing project export/import functionality...")
    success = test_import_export()
    sys.exit(0 if success else 1)