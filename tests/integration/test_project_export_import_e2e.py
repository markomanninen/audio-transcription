#!/usr/bin/env python3
"""
End-to-End integration test for project export/import functionality.

This test runs a complete export/import cycle using the actual service implementations
without requiring a full database setup. All test artifacts are created in the 
tests/integration/output directory.
"""
import os
import sys
import json
import tempfile
import shutil
from pathlib import Path
from datetime import datetime

# Get the test directory and output directory
TEST_DIR = Path(__file__).parent
OUTPUT_DIR = TEST_DIR / "output"
ROOT_DIR = TEST_DIR.parent.parent
BACKEND_DIR = ROOT_DIR / "backend"

# Add backend to Python path
sys.path.insert(0, str(BACKEND_DIR))

def setup_test_environment():
    """Set up test environment variables and directories."""
    # Ensure output directory exists and is clean
    OUTPUT_DIR.mkdir(exist_ok=True)
    
    # Clean up any previous test artifacts
    for item in OUTPUT_DIR.glob("*"):
        if item.is_file():
            item.unlink()
        elif item.is_dir():
            shutil.rmtree(item)
    
    # Set up minimal environment for testing
    test_db_path = OUTPUT_DIR / "test_export_import.db"
    test_audio_dir = OUTPUT_DIR / "test_audio"
    
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{test_db_path}")
    os.environ.setdefault("AUDIO_STORAGE_PATH", str(test_audio_dir))
    
    test_audio_dir.mkdir(exist_ok=True)
    
    return test_db_path, test_audio_dir

def create_test_data(db):
    """Create comprehensive test data for export/import testing."""
    from app.models.project import Project
    from app.models.audio_file import AudioFile, TranscriptionStatus
    from app.models.segment import Segment
    from app.models.speaker import Speaker
    from app.models.edit import Edit
    
    # Create project
    project = Project(
        name="E2E Test Project",
        description="A comprehensive test project for export/import validation",
        project_type="audio",
        content_type="interview"
    )
    db.add(project)
    db.flush()
    
    # Create speakers
    speakers = [
        Speaker(
            project_id=project.id,
            speaker_id="SPEAKER_00",
            display_name="Alice Johnson",
            color="#FF5733"
        ),
        Speaker(
            project_id=project.id,
            speaker_id="SPEAKER_01", 
            display_name="Bob Smith",
            color="#33FF57"
        ),
        Speaker(
            project_id=project.id,
            speaker_id="SPEAKER_02",
            display_name="Carol Brown",
            color="#3357FF"
        )
    ]
    db.add_all(speakers)
    db.flush()
    
    # Create audio files with real content in test directory
    audio_files = []
    test_audio_dir = Path(os.environ["AUDIO_STORAGE_PATH"])
    
    for i, (filename, content, duration) in enumerate([
        ("interview_part1.mp3", b"Mock audio content for interview part 1 " * 50, 180.5),
        ("interview_part2.mp3", b"Mock audio content for interview part 2 " * 75, 245.2),
        ("background_notes.mp3", b"Background audio notes content " * 30, 95.8)
    ], 1):
        
        # Create actual audio file
        audio_path = test_audio_dir / f"test_{i}_{filename}"
        with open(audio_path, 'wb') as f:
            f.write(content)
        
        audio_file = AudioFile(
            project_id=project.id,
            filename=audio_path.name,
            original_filename=filename,
            file_path=str(audio_path),
            file_size=len(content),
            duration=duration,
            format="mp3",
            language="en",
            transcription_status=TranscriptionStatus.COMPLETED,
            transcription_progress=100.0,
            model_used="whisper-medium",
            processing_stats='{"processing_time": 45.2, "memory_peak": 512}'
        )
        db.add(audio_file)
        db.flush()
        audio_files.append(audio_file)
    
    # Create segments with realistic content
    segments = []
    segment_data = [
        # Audio file 1 segments
        (audio_files[0].id, speakers[0].id, 0.0, 5.4, "Hello everyone, welcome to today's interview.", "Hello everyone, welcome to today's interview!"),
        (audio_files[0].id, speakers[1].id, 5.4, 12.8, "Thank you for having me, it's great to be here.", None),
        (audio_files[0].id, speakers[0].id, 12.8, 18.2, "Let's start with your background and experience.", None),
        (audio_files[0].id, speakers[1].id, 18.2, 35.6, "I have been working in software development for over ten years.", "I have been working in software development for over ten years now."),
        
        # Audio file 2 segments  
        (audio_files[1].id, speakers[0].id, 0.0, 7.1, "Moving on to the technical questions.", None),
        (audio_files[1].id, speakers[1].id, 7.1, 25.9, "I specialize in Python and machine learning frameworks.", None),
        (audio_files[1].id, speakers[2].id, 25.9, 32.4, "That's impressive, could you elaborate on your ML experience?", None),
        (audio_files[1].id, speakers[1].id, 32.4, 58.7, "Certainly, I've worked extensively with TensorFlow and PyTorch.", "Certainly, I've worked extensively with TensorFlow, PyTorch, and scikit-learn."),
        
        # Audio file 3 segments
        (audio_files[2].id, speakers[2].id, 0.0, 8.3, "These are some additional notes for the interview.", None),
        (audio_files[2].id, speakers[2].id, 8.3, 15.9, "The candidate shows strong technical skills.", "The candidate demonstrates strong technical skills."),
    ]
    
    for i, (audio_file_id, speaker_id, start, end, original, edited) in enumerate(segment_data):
        segment = Segment(
            audio_file_id=audio_file_id,
            speaker_id=speaker_id,
            start_time=start,
            end_time=end,
            original_text=original,
            edited_text=edited,
            sequence=i % 4,  # Reset sequence per file
            is_passive=False
        )
        db.add(segment)
        db.flush()
        segments.append(segment)
    
    # Create edit history
    edits = []
    edit_data = [
        (segments[0].id, "Hello everyone, welcome to today's interview.", "Hello everyone, welcome to today's interview!", "manual"),
        (segments[3].id, "I have been working in software development for over ten years.", "I have been working in software development for over ten years now.", "manual"),
        (segments[7].id, "Certainly, I've worked extensively with TensorFlow and PyTorch.", "Certainly, I've worked extensively with TensorFlow, PyTorch, and scikit-learn.", "ai_correction"),
        (segments[9].id, "The candidate shows strong technical skills.", "The candidate demonstrates strong technical skills.", "manual"),
    ]
    
    for segment_id, prev_text, new_text, edit_type in edit_data:
        edit = Edit(
            segment_id=segment_id,
            previous_text=prev_text,
            new_text=new_text,
            edit_type=edit_type
        )
        db.add(edit)
        edits.append(edit)
    
    db.commit()
    
    return {
        'project': project,
        'speakers': speakers,
        'audio_files': audio_files,
        'segments': segments,
        'edits': edits
    }

def run_export_test(project_id, db, export_service):
    """Test the export functionality."""
    print("📤 Testing Export...")
    
    try:
        zip_path, filename = export_service.export_project_to_zip(project_id, db)
        
        # Move ZIP to output directory
        output_zip = OUTPUT_DIR / filename
        shutil.move(zip_path, output_zip)
        
        print(f"✅ Export successful: {filename}")
        print(f"   📁 Location: {output_zip}")
        print(f"   📦 Size: {output_zip.stat().st_size:,} bytes")
        
        # Inspect ZIP contents
        import zipfile
        with zipfile.ZipFile(output_zip, 'r') as zipf:
            files = zipf.namelist()
            print(f"   📋 Contains {len(files)} files:")
            for file in sorted(files):
                info = zipf.getinfo(file)
                print(f"      📄 {file:<30} ({info.file_size:,} bytes)")
        
        return output_zip
        
    except Exception as e:
        print(f"❌ Export failed: {e}")
        raise

def run_validation_test(zip_path, export_service):
    """Test the validation functionality."""
    print("\n🔍 Testing Validation...")
    
    try:
        validation = export_service.validate_import_zip(str(zip_path))
        
        print(f"✅ Validation result: {'Valid' if validation.is_valid else 'Invalid'}")
        
        if validation.project_info:
            print("   📋 Project Info:")
            for key, value in validation.project_info.items():
                print(f"      {key}: {value}")
        
        if validation.file_info:
            print("   📊 File Info:")
            for key, value in validation.file_info.items():
                print(f"      {key}: {value}")
        
        if validation.warnings:
            print("   ⚠️  Warnings:")
            for warning in validation.warnings:
                print(f"      - {warning}")
        
        if validation.errors:
            print("   ❌ Errors:")
            for error in validation.errors:
                print(f"      - {error}")
        
        return validation
        
    except Exception as e:
        print(f"❌ Validation failed: {e}")
        raise

def run_import_test(zip_path, db, export_service):
    """Test the import functionality."""
    print("\n📥 Testing Import...")
    
    try:
        result = export_service.import_project_from_zip(
            str(zip_path),
            db,
            new_project_name="E2E Imported Test Project",
            new_project_description="This project was imported during E2E testing"
        )
        
        print(f"✅ Import result: {'Success' if result.success else 'Failed'}")
        
        if result.success:
            print(f"   🆔 New project ID: {result.project_id}")
            
            if result.import_stats:
                print("   📊 Import Statistics:")
                for key, value in result.import_stats.items():
                    print(f"      {key}: {value}")
        
        if result.warnings:
            print("   ⚠️  Warnings:")
            for warning in result.warnings:
                print(f"      - {warning}")
        
        if result.errors:
            print("   ❌ Errors:")
            for error in result.errors:
                print(f"      - {error}")
        
        return result
        
    except Exception as e:
        print(f"❌ Import failed: {e}")
        raise

def verify_imported_data(original_data, imported_project_id, db):
    """Verify that imported data matches original data."""
    print("\n🔬 Verifying Data Integrity...")
    
    from app.models.project import Project
    from app.models.audio_file import AudioFile
    from app.models.segment import Segment
    from app.models.speaker import Speaker
    from app.models.edit import Edit
    
    try:
        # Get imported data
        imported_project = db.query(Project).filter(Project.id == imported_project_id).first()
        imported_audio_files = db.query(AudioFile).filter(AudioFile.project_id == imported_project_id).all()
        imported_segments = db.query(Segment).join(AudioFile).filter(AudioFile.project_id == imported_project_id).all()
        imported_speakers = db.query(Speaker).filter(Speaker.project_id == imported_project_id).all()
        imported_edits = db.query(Edit).join(Segment).join(AudioFile).filter(AudioFile.project_id == imported_project_id).all()
        
        # Verify counts
        checks = [
            ("Project", imported_project is not None, True),
            ("Audio files", len(imported_audio_files), len(original_data['audio_files'])),
            ("Segments", len(imported_segments), len(original_data['segments'])),
            ("Speakers", len(imported_speakers), len(original_data['speakers'])),
            ("Edits", len(imported_edits), len(original_data['edits'])),
        ]
        
        all_passed = True
        for name, actual, expected in checks:
            passed = actual == expected
            status = "✅" if passed else "❌"
            print(f"   {status} {name}: {actual} {'== ' + str(expected) if not isinstance(expected, bool) else ''}")
            if not passed:
                all_passed = False
        
        # Verify project details
        original_project = original_data['project']
        if imported_project:
            project_checks = [
                ("Project type", imported_project.project_type, original_project.project_type),
                ("Content type", imported_project.content_type, original_project.content_type),
            ]
            
            for name, actual, expected in project_checks:
                passed = actual == expected
                status = "✅" if passed else "❌"
                print(f"   {status} {name}: {actual} == {expected}")
                if not passed:
                    all_passed = False
        
        # Verify audio file integrity
        for imported_af in imported_audio_files:
            if imported_af.file_path and os.path.exists(imported_af.file_path):
                file_size = os.path.getsize(imported_af.file_path)
                print(f"   ✅ Audio file copied: {imported_af.original_filename} ({file_size:,} bytes)")
            else:
                print(f"   ❌ Audio file missing: {imported_af.original_filename}")
                all_passed = False
        
        # Verify segment content preservation
        original_texts = {s.original_text for s in original_data['segments']}
        imported_texts = {s.original_text for s in imported_segments}
        
        if original_texts == imported_texts:
            print("   ✅ Segment texts preserved")
        else:
            print("   ❌ Segment texts not preserved")
            print(f"      Missing: {original_texts - imported_texts}")
            print(f"      Extra: {imported_texts - original_texts}")
            all_passed = False
        
        # Verify speaker information
        original_names = {s.display_name for s in original_data['speakers']}
        imported_names = {s.display_name for s in imported_speakers}
        
        if original_names == imported_names:
            print("   ✅ Speaker names preserved")
        else:
            print("   ❌ Speaker names not preserved")
            all_passed = False
        
        # Verify edit history
        original_edit_texts = {(e.previous_text, e.new_text) for e in original_data['edits']}
        imported_edit_texts = {(e.previous_text, e.new_text) for e in imported_edits}
        
        if original_edit_texts == imported_edit_texts:
            print("   ✅ Edit history preserved")
        else:
            print("   ❌ Edit history not preserved")
            all_passed = False
        
        return all_passed
        
    except Exception as e:
        print(f"❌ Data verification failed: {e}")
        return False

def run_e2e_test():
    """Run the complete end-to-end test."""
    print("🚀 Starting E2E Project Export/Import Test")
    print(f"📁 Test output directory: {OUTPUT_DIR}")
    
    try:
        # Setup test environment
        test_db_path, test_audio_dir = setup_test_environment()
        print(f"🗄️  Test database: {test_db_path}")
        print(f"🎵 Test audio directory: {test_audio_dir}")
        
        # Import required modules
        from app.core.database import engine, SessionLocal
        from app.models.base import Base
        from app.services.project_export_import_service import ProjectExportImportService
        
        # Create database tables
        Base.metadata.create_all(bind=engine)
        
        # Create service instance
        export_service = ProjectExportImportService()
        
        # Create test session
        db = SessionLocal()
        
        try:
            print("\n📝 Creating Test Data...")
            # Create comprehensive test data
            original_data = create_test_data(db)
            print(f"✅ Created project: {original_data['project'].name}")
            print(f"   📊 Audio files: {len(original_data['audio_files'])}")
            print(f"   💬 Segments: {len(original_data['segments'])}")
            print(f"   👥 Speakers: {len(original_data['speakers'])}")
            print(f"   ✏️  Edits: {len(original_data['edits'])}")
            
            # Test export
            zip_path = run_export_test(original_data['project'].id, db, export_service)
            
            # Test validation
            validation = run_validation_test(zip_path, export_service)
            if not validation.is_valid:
                raise Exception("Validation failed")
            
            # Test import
            import_result = run_import_test(zip_path, db, export_service)
            if not import_result.success:
                raise Exception("Import failed")
            
            # Verify data integrity
            integrity_passed = verify_imported_data(original_data, import_result.project_id, db)
            
            if integrity_passed:
                print("\n🎉 All E2E tests passed successfully!")
                print(f"📦 Export ZIP saved: {zip_path}")
                print(f"📊 Test artifacts in: {OUTPUT_DIR}")
                return True
            else:
                print("\n❌ Data integrity checks failed!")
                return False
                
        finally:
            db.close()
            
    except Exception as e:
        print(f"\n❌ E2E test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🧪 E2E Project Export/Import Test Suite")
    print("=" * 50)
    
    success = run_e2e_test()
    
    print("\n" + "=" * 50)
    if success:
        print("✅ E2E TEST SUITE PASSED")
        sys.exit(0)
    else:
        print("❌ E2E TEST SUITE FAILED")
        sys.exit(1)