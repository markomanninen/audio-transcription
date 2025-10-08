import sqlite3
import os

db_path = '/app/data/transcription.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check completed transcriptions datetime fields
    cursor.execute("SELECT id, filename, transcription_status, transcription_started_at, transcription_completed_at, created_at, updated_at FROM audio_files WHERE transcription_status = 'completed' ORDER BY id DESC LIMIT 3")
    
    results = cursor.fetchall()
    print(f"Found {len(results)} completed transcriptions:")
    for row in results:
        print(f"File ID {row[0]} ({row[1]}):")
        print(f"  Status: {row[2]}")
        print(f"  Started: {row[3]}")
        print(f"  Completed: {row[4]}")
        print(f"  Created: {row[5]}")
        print(f"  Updated: {row[6]}")
        print()
    
    conn.close()
else:
    print(f"Database not found at {db_path}")