"""
Project export/import service for handling complete project data in ZIP format.
"""
import os
import json
import zipfile
import tempfile
import shutil
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from ..models.project import Project
from ..models.audio_file import AudioFile
from ..models.segment import Segment
from ..models.speaker import Speaker
from ..models.edit import Edit
from ..schemas.project_export import (
    ProjectExportData, 
    ExportedProject, 
    ExportedAudioFile, 
    ExportedSegment, 
    ExportedSpeaker, 
    ExportedEdit,
    ProjectImportResult,
    ProjectImportValidation
)


class ProjectExportImportService:
    """Service for exporting and importing complete projects as ZIP files."""
    
    EXPORT_VERSION = "1.0"
    
    def export_project_to_zip(self, project_id: int, db: Session) -> Tuple[str, str]:
        """
        Export a complete project to a ZIP file.
        
        Args:
            project_id: ID of the project to export
            db: Database session
            
        Returns:
            Tuple of (zip_file_path, filename) for download
            
        Raises:
            ValueError: If project not found or has no data
        """
        # Verify project exists
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")
            
        # Get all related data
        audio_files = db.query(AudioFile).filter(AudioFile.project_id == project_id).all()
        speakers = db.query(Speaker).filter(Speaker.project_id == project_id).all()
        
        # Get all segments for all audio files in the project
        audio_file_ids = [af.id for af in audio_files]
        segments = []
        edits = []
        
        if audio_file_ids:
            segments = db.query(Segment).filter(Segment.audio_file_id.in_(audio_file_ids)).all()
            segment_ids = [s.id for s in segments]
            if segment_ids:
                edits = db.query(Edit).filter(Edit.segment_id.in_(segment_ids)).all()
        
        # Create temporary directory for ZIP creation
        temp_dir = tempfile.mkdtemp()
        
        try:
            # Prepare export data
            export_data = self._prepare_export_data(
                project, audio_files, segments, speakers, edits
            )
            
            # Create audio files mapping and copy audio files
            audio_file_mappings = {}
            audio_dir = os.path.join(temp_dir, "audio")
            os.makedirs(audio_dir, exist_ok=True)
            
            for audio_file in audio_files:
                if audio_file.file_path and os.path.exists(audio_file.file_path):
                    # Create unique filename to avoid conflicts
                    file_extension = os.path.splitext(audio_file.original_filename)[1]
                    unique_filename = f"{audio_file.id}_{audio_file.original_filename}"
                    dest_path = os.path.join(audio_dir, unique_filename)
                    
                    # Copy audio file
                    shutil.copy2(audio_file.file_path, dest_path)
                    audio_file_mappings[audio_file.id] = unique_filename
                else:
                    # File not found, but still record the mapping
                    audio_file_mappings[audio_file.id] = audio_file.original_filename
            
            export_data.audio_file_mappings = audio_file_mappings
            
            # Write metadata files
            self._write_export_metadata(temp_dir, export_data)
            
            # Create ZIP file
            zip_path = tempfile.mktemp(suffix='.zip')
            safe_name = "".join(c for c in project.name if c.isalnum() or c in (' ', '-', '_')).strip()
            filename = f"{safe_name}_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # Add all files from temp directory
                for root, dirs, files in os.walk(temp_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arc_path = os.path.relpath(file_path, temp_dir)
                        zipf.write(file_path, arc_path)
            
            return zip_path, filename
            
        finally:
            # Clean up temporary directory
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    def _prepare_export_data(
        self, 
        project: Project, 
        audio_files: List[AudioFile], 
        segments: List[Segment], 
        speakers: List[Speaker], 
        edits: List[Edit]
    ) -> ProjectExportData:
        """Prepare the export data structure."""
        
        # Convert to export schemas
        exported_project = ExportedProject.model_validate(project)
        exported_audio_files = [ExportedAudioFile.model_validate(af) for af in audio_files]
        exported_segments = [ExportedSegment.model_validate(s) for s in segments]
        exported_speakers = [ExportedSpeaker.model_validate(sp) for sp in speakers]
        exported_edits = [ExportedEdit.model_validate(e) for e in edits]
        
        # Calculate export stats
        export_stats = {
            "total_audio_files": len(audio_files),
            "total_segments": len(segments),
            "total_speakers": len(speakers),
            "total_edits": len(edits),
            "total_duration": sum(af.duration or 0 for af in audio_files),
            "transcribed_files": len([af for af in audio_files if af.transcription_status == "completed"]),
            "files_with_audio": len([af for af in audio_files if af.file_path and os.path.exists(af.file_path)]),
        }
        
        return ProjectExportData(
            export_timestamp=datetime.now(),
            project=exported_project,
            audio_files=exported_audio_files,
            segments=exported_segments,
            speakers=exported_speakers,
            edits=exported_edits,
            audio_file_mappings={},  # Will be filled later
            export_stats=export_stats
        )
    
    def _write_export_metadata(self, temp_dir: str, export_data: ProjectExportData):
        """Write all metadata JSON files to the temporary directory."""
        
        # Main project data file
        with open(os.path.join(temp_dir, "project_data.json"), 'w', encoding='utf-8') as f:
            json.dump(export_data.model_dump(mode='json'), f, indent=2, default=str)
        
        # Individual data files for easier debugging/inspection
        with open(os.path.join(temp_dir, "project.json"), 'w', encoding='utf-8') as f:
            json.dump(export_data.project.model_dump(mode='json'), f, indent=2, default=str)
        
        with open(os.path.join(temp_dir, "audio_files.json"), 'w', encoding='utf-8') as f:
            json.dump([af.model_dump(mode='json') for af in export_data.audio_files], f, indent=2, default=str)
        
        with open(os.path.join(temp_dir, "segments.json"), 'w', encoding='utf-8') as f:
            json.dump([s.model_dump(mode='json') for s in export_data.segments], f, indent=2, default=str)
        
        with open(os.path.join(temp_dir, "speakers.json"), 'w', encoding='utf-8') as f:
            json.dump([sp.model_dump(mode='json') for sp in export_data.speakers], f, indent=2, default=str)
        
        with open(os.path.join(temp_dir, "edits.json"), 'w', encoding='utf-8') as f:
            json.dump([e.model_dump(mode='json') for e in export_data.edits], f, indent=2, default=str)
        
        # Create README file
        readme_content = f"""
# Project Export: {export_data.project.name}

This ZIP file contains a complete export of a transcription project.

## Contents:
- `project_data.json` - Complete project data in single file
- `project.json` - Project metadata
- `audio_files.json` - Audio file metadata
- `segments.json` - Transcription segments
- `speakers.json` - Speaker information
- `edits.json` - Edit history
- `audio/` - Audio files directory

## Import:
This ZIP can be imported into the transcription application to recreate the project.

## Export Details:
- Export Version: {export_data.export_version}
- Export Time: {export_data.export_timestamp}
- Audio Files: {export_data.export_stats['total_audio_files']}
- Segments: {export_data.export_stats['total_segments']}
- Speakers: {export_data.export_stats['total_speakers']}
- Total Duration: {export_data.export_stats['total_duration']:.1f} seconds
"""
        
        with open(os.path.join(temp_dir, "README.txt"), 'w', encoding='utf-8') as f:
            f.write(readme_content)
    
    def validate_import_zip(self, zip_path: str) -> ProjectImportValidation:
        """
        Validate a project import ZIP file without importing it.
        
        Args:
            zip_path: Path to the ZIP file to validate
            
        Returns:
            ProjectImportValidation with validation results
        """
        errors = []
        warnings = []
        project_info = None
        file_info = None
        
        try:
            with zipfile.ZipFile(zip_path, 'r') as zipf:
                file_list = zipf.namelist()
                
                # Check for required files
                required_files = ["project_data.json"]
                for req_file in required_files:
                    if req_file not in file_list:
                        errors.append(f"Missing required file: {req_file}")
                
                if "project_data.json" in file_list:
                    try:
                        # Read and validate project data
                        with zipf.open("project_data.json") as f:
                            data = json.load(f)
                            export_data = ProjectExportData.model_validate(data)
                            
                            project_info = {
                                "name": export_data.project.name,
                                "description": export_data.project.description,
                                "type": export_data.project.project_type,
                                "export_version": export_data.export_version,
                                "export_time": export_data.export_timestamp
                            }
                            
                            file_info = {
                                "audio_files": len(export_data.audio_files),
                                "segments": len(export_data.segments),
                                "speakers": len(export_data.speakers),
                                "edits": len(export_data.edits)
                            }
                            
                            # Check for audio files
                            expected_audio_files = set(export_data.audio_file_mappings.values())
                            actual_audio_files = set(f for f in file_list if f.startswith("audio/"))
                            
                            missing_audio = expected_audio_files - {f.replace("audio/", "") for f in actual_audio_files}
                            if missing_audio:
                                warnings.append(f"Missing audio files: {', '.join(missing_audio)}")
                            
                    except json.JSONDecodeError as e:
                        errors.append(f"Invalid JSON in project_data.json: {e}")
                    except Exception as e:
                        errors.append(f"Failed to parse project data: {e}")
                
        except zipfile.BadZipFile:
            errors.append("Invalid ZIP file")
        except Exception as e:
            errors.append(f"Failed to read ZIP file: {e}")
        
        return ProjectImportValidation(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            project_info=project_info,
            file_info=file_info
        )
    
    def import_project_from_zip(
        self, 
        zip_path: str, 
        db: Session,
        new_project_name: Optional[str] = None,
        new_project_description: Optional[str] = None
    ) -> ProjectImportResult:
        """
        Import a project from a ZIP file.
        
        Args:
            zip_path: Path to the ZIP file to import
            db: Database session
            new_project_name: Optional new name for the project
            new_project_description: Optional new description
            
        Returns:
            ProjectImportResult with import status and details
        """
        errors = []
        warnings = []
        project_id = None
        
        # First validate the ZIP file
        validation = self.validate_import_zip(zip_path)
        if not validation.is_valid:
            return ProjectImportResult(
                success=False,
                project_id=None,
                errors=validation.errors,
                warnings=validation.warnings,
                import_stats={}
            )
        
        # Add validation warnings to our warnings list
        warnings.extend(validation.warnings)
        
        temp_dir = tempfile.mkdtemp()
        created_files = []  # Track created files for cleanup on failure
        
        try:
            # Extract ZIP file
            with zipfile.ZipFile(zip_path, 'r') as zipf:
                zipf.extractall(temp_dir)
            
            # Read project data
            with open(os.path.join(temp_dir, "project_data.json"), 'r', encoding='utf-8') as f:
                data = json.load(f)
                export_data = ProjectExportData.model_validate(data)
            
            # Start database transaction
            try:
                # Create new project
                project_data = export_data.project.model_dump()
                project_data.pop('id')  # Remove original ID
                project_data.pop('created_at', None)
                project_data.pop('updated_at', None)
                
                if new_project_name:
                    project_data['name'] = new_project_name
                if new_project_description:
                    project_data['description'] = new_project_description
                
                new_project = Project(**project_data)
                db.add(new_project)
                db.flush()  # Get the new project ID
                project_id = new_project.id
                
                # Import speakers (they reference project_id)
                speaker_id_mapping = {}
                for speaker_data in export_data.speakers:
                    speaker_dict = speaker_data.model_dump()
                    old_speaker_id = speaker_dict.pop('id')
                    speaker_dict.pop('created_at', None)
                    speaker_dict.pop('updated_at', None)
                    speaker_dict['project_id'] = project_id
                    
                    new_speaker = Speaker(**speaker_dict)
                    db.add(new_speaker)
                    db.flush()
                    speaker_id_mapping[old_speaker_id] = new_speaker.id
                
                # Import audio files
                audio_file_id_mapping = {}
                for audio_file_data in export_data.audio_files:
                    audio_dict = audio_file_data.model_dump()
                    old_audio_id = audio_dict.pop('id')
                    audio_dict.pop('created_at', None)
                    audio_dict.pop('updated_at', None)
                    audio_dict['project_id'] = project_id
                    
                    # Handle audio file copying
                    if old_audio_id in export_data.audio_file_mappings:
                        source_file = os.path.join(temp_dir, "audio", export_data.audio_file_mappings[old_audio_id])
                        if os.path.exists(source_file):
                            # Copy audio file to application's audio directory
                            from ..core.config import settings
                            audio_dir = settings.AUDIO_STORAGE_PATH
                            os.makedirs(audio_dir, exist_ok=True)
                            
                            # Generate unique filename
                            import uuid
                            unique_filename = f"{uuid.uuid4()}_{audio_file_data.original_filename}"
                            dest_path = os.path.join(audio_dir, unique_filename)
                            shutil.copy2(source_file, dest_path)
                            created_files.append(dest_path)  # Track for cleanup
                            
                            audio_dict['file_path'] = dest_path
                            audio_dict['filename'] = unique_filename
                        else:
                            warnings.append(f"Audio file not found for {audio_file_data.original_filename}")
                            audio_dict['file_path'] = ""  # Mark as missing
                    
                    # Handle parent audio file mapping
                    if audio_dict.get('parent_audio_file_id'):
                        if audio_dict['parent_audio_file_id'] in audio_file_id_mapping:
                            audio_dict['parent_audio_file_id'] = audio_file_id_mapping[audio_dict['parent_audio_file_id']]
                        else:
                            audio_dict['parent_audio_file_id'] = None
                            warnings.append("Parent audio file reference could not be resolved")
                    
                    new_audio_file = AudioFile(**audio_dict)
                    db.add(new_audio_file)
                    db.flush()
                    audio_file_id_mapping[old_audio_id] = new_audio_file.id
                
                # Import segments
                segment_id_mapping = {}
                for segment_data in export_data.segments:
                    segment_dict = segment_data.model_dump()
                    old_segment_id = segment_dict.pop('id')
                    segment_dict.pop('created_at', None)
                    segment_dict.pop('updated_at', None)
                    
                    # Map foreign keys
                    if segment_dict['audio_file_id'] not in audio_file_id_mapping:
                        warnings.append(f"Segment skipped due to missing audio file reference")
                        continue
                        
                    segment_dict['audio_file_id'] = audio_file_id_mapping[segment_dict['audio_file_id']]
                    if segment_dict.get('speaker_id') and segment_dict['speaker_id'] in speaker_id_mapping:
                        segment_dict['speaker_id'] = speaker_id_mapping[segment_dict['speaker_id']]
                    else:
                        segment_dict['speaker_id'] = None
                    
                    new_segment = Segment(**segment_dict)
                    db.add(new_segment)
                    db.flush()
                    segment_id_mapping[old_segment_id] = new_segment.id
                
                # Import edits
                edits_imported = 0
                for edit_data in export_data.edits:
                    edit_dict = edit_data.model_dump()
                    edit_dict.pop('id')
                    edit_dict.pop('created_at', None)
                    edit_dict.pop('updated_at', None)
                    
                    # Map segment ID
                    if edit_dict['segment_id'] in segment_id_mapping:
                        edit_dict['segment_id'] = segment_id_mapping[edit_dict['segment_id']]
                        new_edit = Edit(**edit_dict)
                        db.add(new_edit)
                        edits_imported += 1
                    else:
                        warnings.append("Edit record skipped due to missing segment reference")
                
                db.commit()
                
                import_stats = {
                    "project_created": True,
                    "audio_files_imported": len(audio_file_id_mapping),
                    "segments_imported": len(segment_id_mapping),
                    "speakers_imported": len(speaker_id_mapping),
                    "edits_imported": edits_imported,
                    "audio_files_copied": len([f for f in created_files if os.path.exists(f)]),
                }
                
                return ProjectImportResult(
                    success=True,
                    project_id=project_id,
                    errors=errors,
                    warnings=warnings,
                    import_stats=import_stats
                )
                
            except SQLAlchemyError as e:
                db.rollback()
                # Clean up any created files
                for file_path in created_files:
                    try:
                        if os.path.exists(file_path):
                            os.unlink(file_path)
                    except:
                        pass
                        
                errors.append(f"Database import failed: {e}")
                return ProjectImportResult(
                    success=False,
                    project_id=None,
                    errors=errors,
                    warnings=warnings,
                    import_stats={}
                )
            except Exception as e:
                db.rollback()
                # Clean up any created files
                for file_path in created_files:
                    try:
                        if os.path.exists(file_path):
                            os.unlink(file_path)
                    except:
                        pass
                        
                errors.append(f"Import failed: {e}")
                return ProjectImportResult(
                    success=False,
                    project_id=None,
                    errors=errors,
                    warnings=warnings,
                    import_stats={}
                )
        
        except Exception as e:
            errors.append(f"Import failed: {e}")
            return ProjectImportResult(
                success=False,
                project_id=None,
                errors=errors,
                warnings=warnings,
                import_stats={}
            )
        
        finally:
            # Clean up temporary directory
            shutil.rmtree(temp_dir, ignore_errors=True)