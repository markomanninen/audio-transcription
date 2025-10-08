#!/usr/bin/env python3
"""
Quick script to check datetime fields in completed transcriptions.
"""
import sqlite3
import os

def check_datetime_fields():
    """Check if datetime fields are populated for completed transcriptions."""
    db_path = os.path.join("backend", "data", "transcription.db")
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Get schema info
        cursor.execute("PRAGMA table_info(audio_files)")
        columns = cursor.fetchall()
        print("Audio files table columns:")
        for col in columns:
            if 'transcription' in col[1] or 'created' in col[1] or 'updated' in col[1]:
                print(f"  {col[1]} - {col[2]}")
        
        print("\n" + "="*50)
        
        # Check completed transcriptions
        cursor.execute("""
            SELECT id, filename, transcription_status, 
                   transcription_started_at, transcription_completed_at,
                   created_at, updated_at
            FROM audio_files 
            WHERE transcription_status = 'completed'
            ORDER BY id DESC
            LIMIT 5
        """)
        
        results = cursor.fetchall()
        print(f"\nFound {len(results)} completed transcriptions:")
        for row in results:
            print(f"File ID {row[0]} ({row[1]}):")
            print(f"  Status: {row[2]}")
            print(f"  Started: {row[3]}")
            print(f"  Completed: {row[4]}")
            print(f"  Created: {row[5]}")
            print(f"  Updated: {row[6]}")
            print()
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_datetime_fields()