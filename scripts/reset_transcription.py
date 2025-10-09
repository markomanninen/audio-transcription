#!/usr/bin/env python3
import sqlite3
import os

def reset_transcription():
    db_path = '/app/data/transcriptions.db'
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Reset transcription status to pending
        cursor.execute("UPDATE audio_files SET transcription_status = 'PENDING', transcription_progress = 0.0, error_message = NULL")
        conn.commit()
        
        # Check current status
        cursor.execute('SELECT id, transcription_status, transcription_progress, error_message FROM audio_files')
        rows = cursor.fetchall()
        for row in rows:
            print(f'File ID: {row[0]}, Status: {row[1]}, Progress: {row[2]}%, Error: {row[3]}')
        
        conn.close()
        print('Reset completed - ready for new transcription')
    else:
        print('Database not found')

if __name__ == "__main__":
    reset_transcription()