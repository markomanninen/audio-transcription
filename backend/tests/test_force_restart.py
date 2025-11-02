"""
Tests for the force-restart transcription endpoint.
"""
import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy.orm import Session

from app.models.audio_file import AudioFile, TranscriptionStatus
from app.models.project import Project


def _create_audio_file(db: Session, project: Project, status: TranscriptionStatus = TranscriptionStatus.PENDING) -> AudioFile:
    audio_file = AudioFile(
        project_id=project.id,
        filename="test.wav",
        original_filename="test.wav",
        file_path="/tmp/test.wav",
        file_size=1024,
        format="wav",
        transcription_status=status,
    )
    db.add(audio_file)
    db.commit()
    db.refresh(audio_file)
    return audio_file


class TestForceRestartEndpoint:
    """Test cases for POST /api/transcription/{id}/force-restart"""

    def test_force_restart_returns_202_when_whisper_not_ready(self, client, test_db, sample_project):
        """Should return 202 and queue transcription when Whisper is not ready."""
        # Mock the transcription service as not ready
        with patch('app.api.transcription.is_transcription_service_ready') as mock_ready:
            with patch('app.api.transcription.add_pending_transcription') as mock_add_pending:
                with patch('app.api.transcription.initialize_transcription_service'):
                    mock_ready.return_value = False

                    audio_file = _create_audio_file(test_db, sample_project)

                    # Make request
                    response = client.post(
                        f'/api/transcription/{audio_file.id}/force-restart',
                        json={
                            'include_diarization': True,
                            'model_size': 'tiny',
                            'language': None
                        }
                    )

                    # Should return 202 Accepted
                    assert response.status_code == 202
                    payload = response.json()
                    assert 'model loading' in payload.get('message', '').lower()

                    # Should add to pending queue
                    mock_add_pending.assert_called_once()

    def test_force_restart_does_not_return_500(self, client, test_db, sample_project):
        """Should never return 500 Internal Server Error."""
        with patch('app.api.transcription.is_transcription_service_ready') as mock_ready:
            with patch('app.api.transcription.add_pending_transcription'):
                mock_ready.return_value = False

                audio_file = _create_audio_file(test_db, sample_project)

                response = client.post(
                    f'/api/transcription/{audio_file.id}/force-restart',
                    json={
                        'include_diarization': True,
                        'model_size': 'tiny',
                        'language': None
                    }
                )

                # Should NOT be 500
                assert response.status_code != 500

    def test_force_restart_does_not_return_503_when_not_ready(self, client, test_db, sample_project):
        """Should return 202 instead of 503 when service is not ready."""
        with patch('app.api.transcription.is_transcription_service_ready') as mock_ready:
            with patch('app.api.transcription.add_pending_transcription'):
                mock_ready.return_value = False

                audio_file = _create_audio_file(test_db, sample_project)

                response = client.post(
                    f'/api/transcription/{audio_file.id}/force-restart',
                    json={
                        'include_diarization': True,
                        'model_size': 'tiny',
                        'language': None
                    }
                )

                # Should be 202, not 503
                assert response.status_code == 202
                assert response.status_code != 503

    def test_force_restart_starts_transcription_when_ready(self, client, test_db, sample_project):
        """Should start transcription when Whisper is ready."""
        # Create mock database session
        mock_db = MagicMock(spec=Session)

        # Create mock audio file
        mock_audio_file = MagicMock(spec=AudioFile)
        mock_audio_file.id = 1
        mock_audio_file.transcription_status = TranscriptionStatus.COMPLETED
        mock_db.query().filter().first.return_value = mock_audio_file

        with patch('app.api.transcription.is_transcription_service_ready') as mock_ready:
            with patch('app.api.transcription.get_transcription_service') as mock_get_service:
                with patch('app.api.transcription.get_db') as mock_get_db:
                    mock_ready.return_value = True
                    mock_get_db.return_value = mock_db

                    mock_service = MagicMock()
                    mock_service.resume_or_transcribe_audio.return_value = []
                    mock_get_service.return_value = mock_service

                    audio_file = _create_audio_file(test_db, sample_project, TranscriptionStatus.PENDING)

                    response = client.post(
                        f'/api/transcription/{audio_file.id}/force-restart',
                        json={
                            'include_diarization': True,
                            'model_size': 'tiny',
                            'language': None
                        }
                    )

                    # Should return 200 OK when service is ready
                    assert response.status_code == 200

    def test_force_restart_handles_json_correctly(self, client, test_db, sample_project):
        """Should handle JSON serialization without import errors."""
        mock_db = MagicMock(spec=Session)
        mock_audio_file = MagicMock(spec=AudioFile)
        mock_audio_file.id = 1
        mock_db.query().filter().first.return_value = mock_audio_file

        with patch('app.api.transcription.is_transcription_service_ready') as mock_ready:
            with patch('app.api.transcription.get_transcription_service') as mock_get_service:
                with patch('app.api.transcription.get_db') as mock_get_db:
                    mock_ready.return_value = True
                    mock_get_db.return_value = mock_db

                    mock_service = MagicMock()
                    mock_service.resume_or_transcribe_audio.return_value = []
                    mock_get_service.return_value = mock_service

                    # This should not raise "json not defined" error
                    audio_file = _create_audio_file(test_db, sample_project)
                    try:
                        response = client.post(
                            f'/api/transcription/{audio_file.id}/force-restart',
                            json={
                                'include_diarization': True,
                                'model_size': 'tiny',
                                'language': None
                            }
                        )

                        # Should succeed without JSON import errors
                        assert response.status_code in [200, 202, 404]  # Valid responses
                    except NameError as e:
                        if 'json' in str(e):
                            pytest.fail(f"JSON import error occurred: {e}")
                        raise

    def test_force_restart_with_completed_file(self, client, test_db, sample_project):
        """Should allow restarting a completed transcription."""
        mock_db = MagicMock(spec=Session)

        # Create completed file with segments
        mock_audio_file = MagicMock(spec=AudioFile)
        mock_audio_file.id = 1
        mock_audio_file.transcription_status = TranscriptionStatus.COMPLETED
        mock_db.query().filter().first.return_value = mock_audio_file

        with patch('app.api.transcription.is_transcription_service_ready') as mock_ready:
            with patch('app.api.transcription.get_transcription_service') as mock_get_service:
                with patch('app.api.transcription.get_db') as mock_get_db:
                    mock_ready.return_value = True
                    mock_get_db.return_value = mock_db

                    mock_service = MagicMock()
                    mock_service.resume_or_transcribe_audio.return_value = []
                    mock_get_service.return_value = mock_service

                    audio_file = _create_audio_file(test_db, sample_project, TranscriptionStatus.COMPLETED)

                    response = client.post(
                        f'/api/transcription/{audio_file.id}/force-restart',
                        json={
                            'include_diarization': True,
                            'model_size': 'tiny',
                            'language': None
                        }
                    )

                    # Should accept restart of completed file
                    assert response.status_code in [200, 202]

    def test_force_restart_returns_404_for_nonexistent_file(self, client):
        """Should return 404 when file doesn't exist."""
        mock_db = MagicMock(spec=Session)
        mock_db.query().filter().first.return_value = None  # File not found

        with patch('app.api.transcription.is_transcription_service_ready') as mock_ready:
            with patch('app.api.transcription.get_db') as mock_get_db:
                mock_ready.return_value = True
                mock_get_db.return_value = mock_db

                response = client.post(
                    '/api/transcription/999/force-restart',
                        json={
                            'include_diarization': True,
                            'model_size': 'tiny',
                            'language': None
                        }
                )

                assert response.status_code == 404

    def test_force_restart_same_behavior_as_start(self, client, test_db, sample_project):
        """Force-restart should behave the same as start when service not ready."""
        with patch('app.api.transcription.is_transcription_service_ready') as mock_ready:
            with patch('app.api.transcription.add_pending_transcription') as mock_add_pending:
                mock_ready.return_value = False

                audio_file = _create_audio_file(test_db, sample_project)

                # Call force-restart
                restart_response = client.post(
                    f'/api/transcription/{audio_file.id}/force-restart',
                    json={
                        'include_diarization': True,
                        'model_size': 'tiny',
                        'language': None
                    }
                )

                # Call regular start
                start_response = client.post(
                    f'/api/transcription/{audio_file.id}/start',
                    json={
                        'include_diarization': True,
                        'model_size': 'tiny',
                        'language': None
                    }
                )

                # Both should return 202
                assert restart_response.status_code == 202
                assert start_response.status_code == 202
                restart_payload = restart_response.json()
                start_payload = start_response.json()
                assert 'loading' in restart_payload.get('message', '').lower()
                assert 'loading' in start_payload.get('message', '').lower()

                # Both should add to pending queue
                assert mock_add_pending.call_count == 2
