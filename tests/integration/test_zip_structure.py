#!/usr/bin/env python3
"""
Simple test to verify ZIP structure and content without full database setup.
"""
import json
import zipfile
import tempfile
import os
from datetime import datetime

def test_zip_structure():
    """Test creating a sample export ZIP and inspect its contents."""
    
    # Create sample export data structure
    sample_export_data = {
        "export_version": "1.0",
        "export_timestamp": datetime.now().isoformat(),
        "project": {
            "id": 1,
            "name": "Sample Project",
            "description": "A sample project for testing",
            "project_type": "audio",
            "content_type": "interview",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        "audio_files": [
            {
                "id": 1,
                "filename": "test_audio.mp3",
                "original_filename": "original_test.mp3",
                "file_size": 1024000,
                "duration": 120.5,
                "format": "mp3",
                "language": "en",
                "transcription_status": "completed",
                "transcription_progress": 100.0,
                "created_at": datetime.now().isoformat()
            }
        ],
        "segments": [
            {
                "id": 1,
                "audio_file_id": 1,
                "speaker_id": 1,
                "start_time": 0.0,
                "end_time": 5.2,
                "original_text": "Hello, this is a test transcription.",
                "edited_text": "Hello, this is a test transcription!",
                "sequence": 0,
                "is_passive": False,
                "created_at": datetime.now().isoformat()
            },
            {
                "id": 2,
                "audio_file_id": 1,
                "speaker_id": 2,
                "start_time": 5.2,
                "end_time": 10.8,
                "original_text": "Yes, this is working correctly.",
                "edited_text": None,
                "sequence": 1,
                "is_passive": False,
                "created_at": datetime.now().isoformat()
            }
        ],
        "speakers": [
            {
                "id": 1,
                "project_id": 1,
                "speaker_id": "SPEAKER_00",
                "display_name": "Alice",
                "color": "#FF5733",
                "created_at": datetime.now().isoformat()
            },
            {
                "id": 2,
                "project_id": 1,
                "speaker_id": "SPEAKER_01", 
                "display_name": "Bob",
                "color": "#33FF57",
                "created_at": datetime.now().isoformat()
            }
        ],
        "edits": [
            {
                "id": 1,
                "segment_id": 1,
                "previous_text": "Hello, this is a test transcription.",
                "new_text": "Hello, this is a test transcription!",
                "edit_type": "manual",
                "created_at": datetime.now().isoformat()
            }
        ],
        "audio_file_mappings": {
            "1": "1_original_test.mp3"
        },
        "export_stats": {
            "total_audio_files": 1,
            "total_segments": 2,
            "total_speakers": 2,
            "total_edits": 1,
            "total_duration": 120.5,
            "transcribed_files": 1,
            "files_with_audio": 1
        }
    }
    
    # Create temporary directory for ZIP creation
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Create audio directory and sample audio file
        audio_dir = os.path.join(temp_dir, "audio")
        os.makedirs(audio_dir)
        
        sample_audio_path = os.path.join(audio_dir, "1_original_test.mp3")
        with open(sample_audio_path, 'wb') as f:
            f.write(b"This is dummy audio content for testing purposes. " * 100)
        
        # Write main project data file
        with open(os.path.join(temp_dir, "project_data.json"), 'w') as f:
            json.dump(sample_export_data, f, indent=2)
        
        # Write individual data files
        with open(os.path.join(temp_dir, "project.json"), 'w') as f:
            json.dump(sample_export_data["project"], f, indent=2)
        
        with open(os.path.join(temp_dir, "audio_files.json"), 'w') as f:
            json.dump(sample_export_data["audio_files"], f, indent=2)
        
        with open(os.path.join(temp_dir, "segments.json"), 'w') as f:
            json.dump(sample_export_data["segments"], f, indent=2)
        
        with open(os.path.join(temp_dir, "speakers.json"), 'w') as f:
            json.dump(sample_export_data["speakers"], f, indent=2)
        
        with open(os.path.join(temp_dir, "edits.json"), 'w') as f:
            json.dump(sample_export_data["edits"], f, indent=2)
        
        # Create README file
        readme_content = f"""
# Project Export: {sample_export_data['project']['name']}

This ZIP file contains a complete export of a transcription project.

## Contents:
- project_data.json - Complete project data in single file
- project.json - Project metadata
- audio_files.json - Audio file metadata  
- segments.json - Transcription segments
- speakers.json - Speaker information
- edits.json - Edit history
- audio/ - Audio files directory

## Export Details:
- Export Version: {sample_export_data['export_version']}
- Export Time: {sample_export_data['export_timestamp']}
- Audio Files: {sample_export_data['export_stats']['total_audio_files']}
- Segments: {sample_export_data['export_stats']['total_segments']}
- Speakers: {sample_export_data['export_stats']['total_speakers']}
- Total Duration: {sample_export_data['export_stats']['total_duration']} seconds
"""
        
        with open(os.path.join(temp_dir, "README.txt"), 'w') as f:
            f.write(readme_content)
        
        # Create ZIP file
        zip_path = "sample_export_test.zip"
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arc_path = os.path.relpath(file_path, temp_dir)
                    zipf.write(file_path, arc_path)
        
        print(f"✅ ZIP file created: {zip_path}")
        print(f"📦 ZIP file size: {os.path.getsize(zip_path):,} bytes")
        
        # Inspect ZIP contents
        print("\n📋 ZIP Contents:")
        with zipfile.ZipFile(zip_path, 'r') as zipf:
            for info in zipf.infolist():
                print(f"  📄 {info.filename:<25} ({info.file_size:,} bytes)")
        
        # Test extracting and reading content
        print("\n🔍 Content Inspection:")
        with zipfile.ZipFile(zip_path, 'r') as zipf:
            # Read project data
            with zipf.open('project_data.json') as f:
                project_data = json.load(f)
                print(f"  Project: {project_data['project']['name']}")
                print(f"  Type: {project_data['project']['project_type']}")
                print(f"  Audio files: {len(project_data['audio_files'])}")
                print(f"  Segments: {len(project_data['segments'])}")
                print(f"  Speakers: {len(project_data['speakers'])}")
                print(f"  Edits: {len(project_data['edits'])}")
            
            # Check audio file
            audio_files = [f for f in zipf.namelist() if f.startswith('audio/')]
            if audio_files:
                audio_file = audio_files[0]
                with zipf.open(audio_file) as f:
                    audio_content = f.read()
                    print(f"  Audio file: {audio_file} ({len(audio_content):,} bytes)")
            
            # Read README
            with zipf.open('README.txt') as f:
                readme = f.read().decode('utf-8')
                print(f"  README length: {len(readme)} characters")
        
        # Test validation (simulate what the import would do)
        print("\n✅ Validation Test:")
        with zipfile.ZipFile(zip_path, 'r') as zipf:
            required_files = ['project_data.json', 'project.json', 'audio_files.json', 
                            'segments.json', 'speakers.json', 'edits.json', 'README.txt']
            
            file_list = zipf.namelist()
            missing_files = [f for f in required_files if f not in file_list]
            
            if missing_files:
                print(f"  ❌ Missing files: {missing_files}")
            else:
                print("  ✅ All required files present")
            
            # Check for audio files
            audio_files = [f for f in file_list if f.startswith('audio/')]
            print(f"  ✅ Audio files found: {len(audio_files)}")
            
            # Validate JSON structure
            try:
                with zipf.open('project_data.json') as f:
                    data = json.load(f)
                    required_keys = ['export_version', 'export_timestamp', 'project', 
                                   'audio_files', 'segments', 'speakers', 'edits']
                    missing_keys = [k for k in required_keys if k not in data]
                    
                    if missing_keys:
                        print(f"  ❌ Missing data keys: {missing_keys}")
                    else:
                        print("  ✅ JSON structure valid")
                        
            except json.JSONDecodeError as e:
                print(f"  ❌ Invalid JSON: {e}")
        
        print(f"\n🎉 Test completed successfully!")
        print(f"📁 ZIP file saved as: {os.path.abspath(zip_path)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        # Clean up temp directory
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    print("🚀 Testing ZIP export structure and content...")
    success = test_zip_structure()
    print(f"\n{'✅ Success!' if success else '❌ Failed!'}")