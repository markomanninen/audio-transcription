"""
Utilities for reconciling transcription status values stored in the database.
"""
from __future__ import annotations

from sqlalchemy import text, bindparam
from sqlalchemy.engine import Engine

from ..models.audio_file import TranscriptionStatus


def normalize_transcription_statuses(engine: Engine) -> dict[str, int]:
    """
    Ensure all persisted transcription statuses use the canonical enum values.

    Lowercase legacy entries are converted to uppercase. Any status that still
    fails validation after the conversion is marked as FAILED so that FastAPI
    can serve the record instead of raising during enum casting.
    """
    canonical_values = [status.value for status in TranscriptionStatus]

    lowercase_update = text(
        """
        UPDATE audio_files
        SET transcription_status = UPPER(transcription_status)
        WHERE transcription_status IS NOT NULL
          AND transcription_status != UPPER(transcription_status)
        """
    )

    invalid_update = (
        text(
            """
            UPDATE audio_files
            SET
                transcription_status = 'FAILED',
                error_message = COALESCE(
                    error_message,
                    'Transcription status was invalid and has been reset to FAILED.'
                )
            WHERE transcription_status IS NOT NULL
              AND UPPER(transcription_status) NOT IN :allowed_values
            """
        )
        .bindparams(bindparam("allowed_values", expanding=True))
    )

    with engine.begin() as connection:
        lowercase_result = connection.execute(lowercase_update)
        invalid_result = connection.execute(
            invalid_update,
            {"allowed_values": tuple(canonical_values)},
        )

    return {
        "normalized": lowercase_result.rowcount,
        "invalid_reset": invalid_result.rowcount,
    }
