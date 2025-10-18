import logging
from sqlalchemy import text
from sqlalchemy.engine import Engine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def upgrade(engine: Engine):
    """
    Apply the migration:
    1. Create the 'text_documents' table.
    2. Add the 'project_type' column to the 'projects' table.
    """
    logger.info("Applying migration: add_text_document_and_project_type")

    with engine.connect() as connection:
        try:
            with connection.begin():
                logger.info("Creating 'text_documents' table...")
                connection.execute(text("""
                    CREATE TABLE text_documents (
                        id SERIAL PRIMARY KEY,
                        project_id INTEGER NOT NULL UNIQUE,
                        content TEXT NOT NULL DEFAULT '',
                        history TEXT NOT NULL DEFAULT '[]',
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                        FOREIGN KEY(project_id) REFERENCES projects(id)
                    );
                """))
                logger.info("'text_documents' table created successfully.")

                logger.info("Adding 'project_type' column to 'projects' table...")
                connection.execute(text("""
                    ALTER TABLE projects
                    ADD COLUMN project_type VARCHAR(50) NOT NULL DEFAULT 'audio';
                """))
                logger.info("'project_type' column added successfully.")

            logger.info("Migration applied successfully.")
        except Exception as e:
            logger.error(f"Error applying migration: {e}")
            raise

def downgrade(engine: Engine):
    """
    Revert the migration:
    1. Drop the 'text_documents' table.
    2. Remove the 'project_type' column from the 'projects' table.
    """
    logger.info("Reverting migration: add_text_document_and_project_type")

    with engine.connect() as connection:
        try:
            with connection.begin():
                logger.info("Dropping 'text_documents' table...")
                connection.execute(text("DROP TABLE IF EXISTS text_documents;"))
                logger.info("'text_documents' table dropped successfully.")

                logger.info("Removing 'project_type' column from 'projects' table...")
                connection.execute(text("ALTER TABLE projects DROP COLUMN IF EXISTS project_type;"))
                logger.info("'project_type' column removed successfully.")

            logger.info("Migration reverted successfully.")
        except Exception as e:
            logger.error(f"Error reverting migration: {e}")
            raise