from sqlalchemy import create_engine, text

engine = create_engine('sqlite:///./data/transcriptions.db')
with engine.connect() as conn:
    result = conn.execute(text('SELECT id, substr(original_text, 1, 50) as text FROM segments LIMIT 5'))
    for row in result:
        print(f"ID: {row[0]}, Text: {row[1]}")
