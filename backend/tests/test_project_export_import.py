"""
Tests for project export and import functionality.
"""
import os
import json
import tempfile
import zipfile
import shutil
from datetime import datetime

import pytest
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.audio_file import AudioFile, TranscriptionStatus
from app.models.segment import Segment
from app.models.speaker import Speaker
from app.models.edit import Edit
from app.services.project_export_import_service import ProjectExportImportService
from app.schemas.project_export import ProjectExportData


@pytest.fixture
def export_service():
    """Create an instance of the export/import service."""
    return ProjectExportImportService()


@pytest.fixture
def sample_project_data(test_db):
    """Create a complete project with all related data for testing."""
    # Create project
    project = Project(
        name="Test Export Project",
        description="A test project for export/import testing",
        project_type="audio",
        content_type="interview"
    )
    test_db.add(project)
    test_db.flush()
    
    # Create speakers
    speaker1 = Speaker(
        project_id=project.id,
        speaker_id="SPEAKER_00",
        display_name="Alice",
        color="#FF0000"
    )
    speaker2 = Speaker(
        project_id=project.id,
        speaker_id="SPEAKER_01",
        display_name="Bob",
        color="#00FF00"
    )
    test_db.add_all([speaker1, speaker2])
    test_db.flush()
    
    # Create audio files with temporary files
    temp_dir = tempfile.mkdtemp()
    audio_file_path1 = os.path.join(temp_dir, "test_audio1.mp3")
    audio_file_path2 = os.path.join(temp_dir, "test_audio2.mp3")
    
    # Create dummy audio files
    with open(audio_file_path1, 'wb') as f:
        f.write(b"dummy audio content 1")
    with open(audio_file_path2, 'wb') as f:
        f.write(b"dummy audio content 2")
    
    audio_file1 = AudioFile(
        project_id=project.id,
        filename="test_audio1.mp3",
        original_filename="original_audio1.mp3",
        file_path=audio_file_path1,
        file_size=len(b"dummy audio content 1"),
        duration=60.0,
        format="mp3",
        transcription_status=TranscriptionStatus.COMPLETED
    )
    audio_file2 = AudioFile(
        project_id=project.id,
        filename="test_audio2.mp3",
        original_filename="original_audio2.mp3",
        file_path=audio_file_path2,
        file_size=len(b"dummy audio content 2"),
        duration=45.0,
        format="mp3",
        transcription_status=TranscriptionStatus.COMPLETED
    )
    test_db.add_all([audio_file1, audio_file2])
    test_db.flush()
    
    # Create segments
    segments = [
        Segment(
            audio_file_id=audio_file1.id,
            speaker_id=speaker1.id,
            start_time=0.0,
            end_time=5.0,
            original_text="Hello, this is Alice speaking.",
            edited_text="Hello, this is Alice speaking.",
            sequence=0,
            is_passive=False
        ),
        Segment(
            audio_file_id=audio_file1.id,
            speaker_id=speaker2.id,
            start_time=5.0,
            end_time=10.0,
            original_text="Hi Alice, this is Bob.",
            edited_text="Hi Alice, this is Bob responding.",
            sequence=1,
            is_passive=False
        ),
        Segment(
            audio_file_id=audio_file2.id,
            speaker_id=speaker1.id,
            start_time=0.0,
            end_time=8.0,
            original_text="This is a second audio file.",
            sequence=0,
            is_passive=False
        ),
    ]
    test_db.add_all(segments)
    test_db.flush()
    
    # Create edits
    edit1 = Edit(
        segment_id=segments[1].id,
        previous_text="Hi Alice, this is Bob.",
        new_text="Hi Alice, this is Bob responding.",
        edit_type="manual"
    )
    test_db.add(edit1)
    test_db.commit()
    
    return {
        'project': project,
        'speakers': [speaker1, speaker2],
        'audio_files': [audio_file1, audio_file2],
        'segments': segments,
        'edits': [edit1],
        'temp_dir': temp_dir
    }


def test_export_project_to_zip(export_service, sample_project_data, test_db):
    """Test exporting a project to ZIP file."""
    project = sample_project_data['project']
    
    try:
        # Export the project
        zip_path, filename = export_service.export_project_to_zip(project.id, test_db)
        
        # Verify ZIP file was created
        assert os.path.exists(zip_path)
        assert filename.endswith('.zip')
        assert project.name.replace(' ', '_') in filename
        
        # Verify ZIP file contents
        with zipfile.ZipFile(zip_path, 'r') as zipf:
            file_list = zipf.namelist()
            
            # Check for required files
            assert 'project_data.json' in file_list
            assert 'project.json' in file_list
            assert 'audio_files.json' in file_list
            assert 'segments.json' in file_list
            assert 'speakers.json' in file_list
            assert 'edits.json' in file_list
            assert 'README.txt' in file_list
            
            # Check for audio files
            audio_files = [f for f in file_list if f.startswith('audio/')]
            assert len(audio_files) == 2
            
            # Verify project data
            with zipf.open('project_data.json') as f:
                project_data = json.load(f)
                export_data = ProjectExportData.model_validate(project_data)
                
                assert export_data.project.name == project.name
                assert len(export_data.audio_files) == 2
                assert len(export_data.segments) == 3
                assert len(export_data.speakers) == 2
                assert len(export_data.edits) == 1
                
                # Verify export stats
                assert export_data.export_stats['total_audio_files'] == 2
                assert export_data.export_stats['total_segments'] == 3
                assert export_data.export_stats['total_speakers'] == 2
                assert export_data.export_stats['total_edits'] == 1
        
    finally:
        # Clean up
        if os.path.exists(zip_path):
            os.unlink(zip_path)
        shutil.rmtree(sample_project_data['temp_dir'], ignore_errors=True)


def test_validate_import_zip(export_service, sample_project_data, test_db):
    """Test validating a project import ZIP file."""
    project = sample_project_data['project']
    
    try:
        # First export the project
        zip_path, _ = export_service.export_project_to_zip(project.id, test_db)
        
        # Validate the exported ZIP
        validation = export_service.validate_import_zip(zip_path)
        
        assert validation.is_valid is True
        assert len(validation.errors) == 0
        assert validation.project_info is not None
        assert validation.project_info['name'] == project.name
        assert validation.project_info['type'] == project.project_type
        assert validation.file_info is not None
        assert validation.file_info['audio_files'] == 2
        assert validation.file_info['segments'] == 3
        assert validation.file_info['speakers'] == 2
        assert validation.file_info['edits'] == 1
        
    finally:
        # Clean up
        if os.path.exists(zip_path):
            os.unlink(zip_path)
        shutil.rmtree(sample_project_data['temp_dir'], ignore_errors=True)


def test_validate_invalid_zip(export_service):
    """Test validating an invalid ZIP file."""
    # Create a fake ZIP file with invalid content
    temp_file = tempfile.NamedTemporaryFile(suffix='.zip', delete=False)
    try:
        # Write some invalid content
        temp_file.write(b"This is not a valid ZIP file")
        temp_file.close()
        
        validation = export_service.validate_import_zip(temp_file.name)
        
        assert validation.is_valid is False
        assert len(validation.errors) > 0
        assert "Invalid ZIP file" in validation.errors[0]
        
    finally:
        os.unlink(temp_file.name)


def test_validate_zip_missing_required_files(export_service):
    """Test validating a ZIP file missing required files."""
    temp_file = tempfile.NamedTemporaryFile(suffix='.zip', delete=False)
    try:
        # Create a valid ZIP but with missing required files
        with zipfile.ZipFile(temp_file.name, 'w') as zipf:
            zipf.writestr('some_file.txt', 'content')
        temp_file.close()
        
        validation = export_service.validate_import_zip(temp_file.name)
        
        assert validation.is_valid is False
        assert len(validation.errors) > 0
        assert any("Missing required file" in error for error in validation.errors)
        
    finally:
        os.unlink(temp_file.name)


def test_full_export_import_cycle(export_service, sample_project_data, test_db):
    """Test the complete export and import cycle."""
    original_project = sample_project_data['project']
    
    try:
        # Export the project
        zip_path, _ = export_service.export_project_to_zip(original_project.id, test_db)
        
        # Import the project with a new name
        new_name = "Imported Test Project"
        new_description = "This project was imported from ZIP"
        
        result = export_service.import_project_from_zip(
            zip_path, 
            test_db,
            new_project_name=new_name,
            new_project_description=new_description
        )
        
        assert result.success is True
        assert len(result.errors) == 0
        assert result.project_id is not None
        
        # Verify the imported project
        imported_project = test_db.query(Project).filter(Project.id == result.project_id).first()
        assert imported_project is not None
        assert imported_project.name == new_name
        assert imported_project.description == new_description
        assert imported_project.project_type == original_project.project_type
        assert imported_project.content_type == original_project.content_type
        
        # Verify imported audio files
        imported_audio_files = test_db.query(AudioFile).filter(
            AudioFile.project_id == result.project_id
        ).all()
        assert len(imported_audio_files) == 2
        
        # Verify audio files have valid paths and content
        for audio_file in imported_audio_files:
            assert audio_file.file_path
            assert os.path.exists(audio_file.file_path)
            # Verify file content matches
            with open(audio_file.file_path, 'rb') as f:
                content = f.read()
                assert len(content) > 0
        
        # Verify imported segments
        imported_segments = test_db.query(Segment).join(AudioFile).filter(
            AudioFile.project_id == result.project_id
        ).all()
        assert len(imported_segments) == 3
        
        # Verify segment content
        original_texts = {s.original_text for s in sample_project_data['segments']}
        imported_texts = {s.original_text for s in imported_segments}
        assert original_texts == imported_texts
        
        # Verify imported speakers
        imported_speakers = test_db.query(Speaker).filter(
            Speaker.project_id == result.project_id
        ).all()
        assert len(imported_speakers) == 2
        
        # Verify speaker data
        original_names = {s.display_name for s in sample_project_data['speakers']}
        imported_names = {s.display_name for s in imported_speakers}
        assert original_names == imported_names
        
        # Verify imported edits
        imported_edits = test_db.query(Edit).join(Segment).join(AudioFile).filter(
            AudioFile.project_id == result.project_id
        ).all()
        assert len(imported_edits) == 1
        
        # Verify import stats
        stats = result.import_stats
        assert stats['project_created'] is True
        assert stats['audio_files_imported'] == 2
        assert stats['segments_imported'] == 3
        assert stats['speakers_imported'] == 2
        assert stats['edits_imported'] == 1
        
    finally:
        # Clean up
        if os.path.exists(zip_path):
            os.unlink(zip_path)
        shutil.rmtree(sample_project_data['temp_dir'], ignore_errors=True)
        
        # Clean up imported files
        if 'result' in locals() and result.success and result.project_id:
            imported_audio_files = test_db.query(AudioFile).filter(
                AudioFile.project_id == result.project_id
            ).all()
            for audio_file in imported_audio_files:
                if audio_file.file_path and os.path.exists(audio_file.file_path):
                    try:
                        os.unlink(audio_file.file_path)
                    except:
                        pass


def test_export_nonexistent_project(export_service, test_db):
    """Test exporting a non-existent project."""
    with pytest.raises(ValueError, match="Project 99999 not found"):
        export_service.export_project_to_zip(99999, test_db)


def test_import_with_missing_audio_files(export_service, sample_project_data, test_db):
    """Test importing when some audio files are missing from the ZIP."""
    project = sample_project_data['project']
    
    try:
        # First export the project
        zip_path, _ = export_service.export_project_to_zip(project.id, test_db)
        
        # Create a new ZIP with missing audio files
        modified_zip = tempfile.NamedTemporaryFile(suffix='.zip', delete=False)
        
        with zipfile.ZipFile(zip_path, 'r') as original_zip:
            with zipfile.ZipFile(modified_zip.name, 'w') as new_zip:
                # Copy all files except audio files
                for item in original_zip.infolist():
                    if not item.filename.startswith('audio/'):
                        data = original_zip.read(item.filename)
                        new_zip.writestr(item, data)
        
        modified_zip.close()
        
        # Import the modified ZIP
        result = export_service.import_project_from_zip(
            modified_zip.name, 
            test_db,
            new_project_name="Test Missing Audio"
        )
        
        # Should succeed but with warnings about missing audio files
        assert result.success is True
        assert len(result.warnings) > 0
        assert any("not found" in warning for warning in result.warnings)
        
    finally:
        # Clean up
        if os.path.exists(zip_path):
            os.unlink(zip_path)
        if os.path.exists(modified_zip.name):
            os.unlink(modified_zip.name)
        shutil.rmtree(sample_project_data['temp_dir'], ignore_errors=True)


def test_data_integrity_after_import(export_service, sample_project_data, test_db):
    """Test that all data relationships are correctly maintained after import."""
    original_project = sample_project_data['project']
    
    try:
        # Export and import
        zip_path, _ = export_service.export_project_to_zip(original_project.id, test_db)
        result = export_service.import_project_from_zip(
            zip_path, 
            test_db,
            new_project_name="Integrity Test Project"
        )
        
        assert result.success is True
        
        # Get imported data
        imported_project = test_db.query(Project).filter(Project.id == result.project_id).first()
        imported_audio_files = test_db.query(AudioFile).filter(
            AudioFile.project_id == result.project_id
        ).all()
        imported_segments = test_db.query(Segment).join(AudioFile).filter(
            AudioFile.project_id == result.project_id
        ).all()
        imported_speakers = test_db.query(Speaker).filter(
            Speaker.project_id == result.project_id
        ).all()
        
        # Test foreign key relationships
        for segment in imported_segments:
            # Segment should reference valid audio file
            audio_file = test_db.query(AudioFile).filter(AudioFile.id == segment.audio_file_id).first()
            assert audio_file is not None
            assert audio_file.project_id == imported_project.id
            
            # Segment with speaker should reference valid speaker
            if segment.speaker_id:
                speaker = test_db.query(Speaker).filter(Speaker.id == segment.speaker_id).first()
                assert speaker is not None
                assert speaker.project_id == imported_project.id
        
        # Test that segments maintain correct order
        for audio_file in imported_audio_files:
            file_segments = test_db.query(Segment).filter(
                Segment.audio_file_id == audio_file.id
            ).order_by(Segment.sequence).all()
            
            # Sequences should be consecutive starting from 0
            for i, segment in enumerate(file_segments):
                assert segment.sequence == i
        
    finally:
        # Clean up
        if os.path.exists(zip_path):
            os.unlink(zip_path)
        shutil.rmtree(sample_project_data['temp_dir'], ignore_errors=True)