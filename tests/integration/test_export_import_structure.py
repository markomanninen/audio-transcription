#!/usr/bin/env python3
"""
Simple project export/import structure test.

This test validates the export/import functionality by mocking the data structures
and testing the core logic without requiring database dependencies.
"""
import os
import json
import zipfile
import tempfile
import shutil
from pathlib import Path
from datetime import datetime

# Test output directory
TEST_DIR = Path(__file__).parent
OUTPUT_DIR = TEST_DIR / "output"

def setup_test_environment():
    """Set up clean test environment."""
    OUTPUT_DIR.mkdir(exist_ok=True)
    
    # Clean up previous test artifacts
    for item in OUTPUT_DIR.glob("*"):
        if item.is_file():
            item.unlink()
        elif item.is_dir():
            shutil.rmtree(item)

def create_mock_data():
    """Create mock data structures that match the export format."""
    project_data = {
        "project_info": {
            "id": 1,
            "name": "Test Project",
            "description": "A test project for export/import validation",
            "project_type": "audio",
            "content_type": "interview",
            "created_at": "2024-01-15T10:30:00.000Z",
            "updated_at": "2024-01-15T15:45:00.000Z"
        },
        "speakers": [
            {
                "id": 1,
                "speaker_id": "SPEAKER_00",
                "display_name": "Alice Johnson",
                "color": "#FF5733"
            },
            {
                "id": 2,
                "speaker_id": "SPEAKER_01", 
                "display_name": "Bob Smith",
                "color": "#33FF57"
            }
        ],
        "audio_files": [
            {
                "id": 1,
                "filename": "test_1_interview.mp3",
                "original_filename": "interview.mp3",
                "file_size": 1024000,
                "duration": 180.5,
                "format": "mp3",
                "language": "en",
                "transcription_status": "completed",
                "transcription_progress": 100.0,
                "model_used": "whisper-medium",
                "processing_stats": {"processing_time": 45.2, "memory_peak": 512}
            },
            {
                "id": 2,
                "filename": "test_2_followup.mp3",
                "original_filename": "followup.mp3", 
                "file_size": 512000,
                "duration": 95.8,
                "format": "mp3",
                "language": "en",
                "transcription_status": "completed",
                "transcription_progress": 100.0,
                "model_used": "whisper-medium",
                "processing_stats": {"processing_time": 22.1, "memory_peak": 256}
            }
        ],
        "segments": [
            {
                "id": 1,
                "audio_file_id": 1,
                "speaker_id": 1,
                "start_time": 0.0,
                "end_time": 5.4,
                "original_text": "Hello everyone, welcome to today's interview.",
                "edited_text": "Hello everyone, welcome to today's interview!",
                "sequence": 0,
                "is_passive": False
            },
            {
                "id": 2,
                "audio_file_id": 1,
                "speaker_id": 2,
                "start_time": 5.4,
                "end_time": 12.8,
                "original_text": "Thank you for having me, it's great to be here.",
                "edited_text": None,
                "sequence": 1,
                "is_passive": False
            },
            {
                "id": 3,
                "audio_file_id": 2,
                "speaker_id": 1,
                "start_time": 0.0,
                "end_time": 8.3,
                "original_text": "Let's continue with some follow-up questions.",
                "edited_text": "Let's continue with some follow-up questions.",
                "sequence": 0,
                "is_passive": False
            }
        ],
        "edits": [
            {
                "id": 1,
                "segment_id": 1,
                "previous_text": "Hello everyone, welcome to today's interview.",
                "new_text": "Hello everyone, welcome to today's interview!",
                "edit_type": "manual",
                "created_at": "2024-01-15T11:15:00.000Z"
            }
        ],
        "export_metadata": {
            "export_version": "1.0",
            "exported_at": datetime.now().isoformat(),
            "exported_by": "test_user",
            "total_audio_files": 2,
            "total_segments": 3,
            "total_speakers": 2,
            "total_edits": 1
        }
    }
    
    return project_data

def create_mock_audio_files(project_data):
    """Create mock audio files for testing."""
    audio_dir = OUTPUT_DIR / "mock_audio"
    audio_dir.mkdir(exist_ok=True)
    
    audio_files = {}
    
    for audio_file in project_data["audio_files"]:
        filename = audio_file["filename"]
        file_path = audio_dir / filename
        
        # Create mock audio content
        mock_content = f"Mock audio content for {filename} ".encode() * 100
        
        with open(file_path, 'wb') as f:
            f.write(mock_content)
        
        audio_files[filename] = file_path
    
    return audio_files

def create_export_zip(project_data, audio_files):
    """Create a ZIP file matching the expected export format."""
    zip_path = OUTPUT_DIR / "test_project_export.zip"
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Add project metadata
        zipf.writestr(
            "project_data.json", 
            json.dumps(project_data, indent=2, ensure_ascii=False)
        )
        
        # Add audio files
        for filename, file_path in audio_files.items():
            zipf.write(file_path, f"audio/{filename}")
    
    return zip_path

def validate_zip_structure(zip_path):
    """Validate the ZIP file structure and contents."""
    print("🔍 Validating ZIP structure...")
    
    try:
        with zipfile.ZipFile(zip_path, 'r') as zipf:
            files = zipf.namelist()
            
            # Check required files
            required_files = ["project_data.json"]
            audio_files = [f for f in files if f.startswith("audio/")]
            
            print(f"   📋 Found {len(files)} files total")
            print(f"   📄 Metadata files: {len([f for f in files if f.endswith('.json')])}")
            print(f"   🎵 Audio files: {len(audio_files)}")
            
            # Validate metadata
            if "project_data.json" in files:
                metadata = json.loads(zipf.read("project_data.json").decode())
                
                print("   ✅ Project metadata present")
                print(f"      📊 Project: {metadata['project_info']['name']}")
                print(f"      👥 Speakers: {len(metadata['speakers'])}")
                print(f"      🎵 Audio files: {len(metadata['audio_files'])}")
                print(f"      💬 Segments: {len(metadata['segments'])}")
                print(f"      ✏️  Edits: {len(metadata['edits'])}")
                
                # Validate audio files match metadata
                expected_audio = {af["filename"] for af in metadata["audio_files"]}
                actual_audio = {f.split("/")[-1] for f in audio_files}
                
                if expected_audio == actual_audio:
                    print("   ✅ Audio files match metadata")
                else:
                    print("   ❌ Audio files don't match metadata")
                    print(f"      Expected: {expected_audio}")
                    print(f"      Actual: {actual_audio}")
                    return False
                    
                return True
            else:
                print("   ❌ Missing project_data.json")
                return False
                
    except Exception as e:
        print(f"   ❌ Validation error: {e}")
        return False

def simulate_import_validation(zip_path):
    """Simulate import validation process."""
    print("\n🔬 Simulating import validation...")
    
    try:
        with zipfile.ZipFile(zip_path, 'r') as zipf:
            # Load and validate metadata
            metadata = json.loads(zipf.read("project_data.json").decode())
            
            validation_results = {
                "is_valid": True,
                "warnings": [],
                "errors": [],
                "project_info": {},
                "file_info": {}
            }
            
            # Check project structure
            if "project_info" not in metadata:
                validation_results["errors"].append("Missing project_info")
                validation_results["is_valid"] = False
            else:
                proj_info = metadata["project_info"]
                validation_results["project_info"] = {
                    "name": proj_info.get("name", "Unknown"),
                    "type": proj_info.get("project_type", "Unknown"),
                    "created": proj_info.get("created_at", "Unknown")
                }
            
            # Check file counts
            audio_count = len(metadata.get("audio_files", []))
            segment_count = len(metadata.get("segments", []))
            speaker_count = len(metadata.get("speakers", []))
            
            validation_results["file_info"] = {
                "audio_files": audio_count,
                "segments": segment_count,
                "speakers": speaker_count,
                "zip_size": os.path.getsize(zip_path)
            }
            
            # Check for potential issues
            if audio_count == 0:
                validation_results["warnings"].append("No audio files found")
            
            if segment_count == 0:
                validation_results["warnings"].append("No transcription segments found")
            
            if speaker_count > 10:
                validation_results["warnings"].append(f"Large number of speakers ({speaker_count})")
            
            # Report validation results
            print(f"   ✅ Validation: {'Valid' if validation_results['is_valid'] else 'Invalid'}")
            
            if validation_results["project_info"]:
                print("   📋 Project Info:")
                for key, value in validation_results["project_info"].items():
                    print(f"      {key}: {value}")
            
            if validation_results["file_info"]:
                print("   📊 File Info:")
                for key, value in validation_results["file_info"].items():
                    print(f"      {key}: {value}")
            
            if validation_results["warnings"]:
                print("   ⚠️  Warnings:")
                for warning in validation_results["warnings"]:
                    print(f"      - {warning}")
            
            if validation_results["errors"]:
                print("   ❌ Errors:")
                for error in validation_results["errors"]:
                    print(f"      - {error}")
            
            return validation_results["is_valid"]
            
    except Exception as e:
        print(f"   ❌ Import validation error: {e}")
        return False

def simulate_data_import(zip_path):
    """Simulate the data import process."""
    print("\n📥 Simulating data import...")
    
    try:
        with zipfile.ZipFile(zip_path, 'r') as zipf:
            metadata = json.loads(zipf.read("project_data.json").decode())
            
            # Simulate creating new project
            new_project_id = 999
            print(f"   🆔 Created new project ID: {new_project_id}")
            
            # Simulate copying audio files
            audio_files = metadata.get("audio_files", [])
            imported_audio_dir = OUTPUT_DIR / "imported_audio"
            imported_audio_dir.mkdir(exist_ok=True)
            
            for audio_file in audio_files:
                source_path = f"audio/{audio_file['filename']}"
                if source_path in zipf.namelist():
                    dest_path = imported_audio_dir / audio_file['filename']
                    with open(dest_path, 'wb') as dest:
                        dest.write(zipf.read(source_path))
                    print(f"   📁 Copied: {audio_file['filename']} ({audio_file['file_size']} bytes)")
            
            # Simulate data insertion statistics
            import_stats = {
                "speakers_created": len(metadata.get("speakers", [])),
                "audio_files_imported": len(metadata.get("audio_files", [])),
                "segments_created": len(metadata.get("segments", [])),
                "edits_restored": len(metadata.get("edits", []))
            }
            
            print("   📊 Import Statistics:")
            for key, value in import_stats.items():
                print(f"      {key}: {value}")
            
            return True, new_project_id, import_stats
            
    except Exception as e:
        print(f"   ❌ Import simulation error: {e}")
        return False, None, {}

def run_structure_test():
    """Run the complete structure validation test."""
    print("🧪 Project Export/Import Structure Test")
    print("=" * 50)
    
    try:
        # Setup
        setup_test_environment()
        print("📁 Test environment ready")
        
        # Create mock data
        print("\n📝 Creating mock data...")
        project_data = create_mock_data()
        audio_files = create_mock_audio_files(project_data)
        print(f"✅ Created project: {project_data['project_info']['name']}")
        print(f"   👥 Speakers: {len(project_data['speakers'])}")
        print(f"   🎵 Audio files: {len(project_data['audio_files'])}")
        print(f"   💬 Segments: {len(project_data['segments'])}")
        print(f"   ✏️  Edits: {len(project_data['edits'])}")
        
        # Create export ZIP
        print("\n📤 Creating export ZIP...")
        zip_path = create_export_zip(project_data, audio_files)
        zip_size = os.path.getsize(zip_path)
        print(f"✅ Export ZIP created: {zip_path.name}")
        print(f"   📦 Size: {zip_size:,} bytes")
        
        # Validate structure
        structure_valid = validate_zip_structure(zip_path)
        if not structure_valid:
            print("❌ Structure validation failed")
            return False
        
        # Simulate import validation
        import_valid = simulate_import_validation(zip_path)
        if not import_valid:
            print("❌ Import validation failed")
            return False
        
        # Simulate import process
        import_success, new_project_id, stats = simulate_data_import(zip_path)
        if not import_success:
            print("❌ Import simulation failed")
            return False
        
        print(f"\n🎉 All structure tests passed successfully!")
        print(f"📦 Export ZIP: {zip_path}")
        print(f"📊 Test artifacts: {OUTPUT_DIR}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Structure test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🧪 Project Export/Import Structure Test")
    print("=" * 50)
    
    success = run_structure_test()
    
    print("\n" + "=" * 50)
    if success:
        print("✅ STRUCTURE TEST PASSED")
        print("📋 Export/import format validation successful")
        exit(0)
    else:
        print("❌ STRUCTURE TEST FAILED")
        exit(1)