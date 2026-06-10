import os
import sys
from dotenv import load_dotenv

# Load env before importing settings to ensure correct configuration file is read
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(backend_dir, ".env"))

# Add parent directory to path to import config
sys.path.append(backend_dir)

from app.config import settings
import psycopg2

def run_migrations():
    print("Starting database migration on local PostgreSQL...")
    sync_url = settings.DATABASE_URL_SYNC
    if not sync_url:
        print("Error: DATABASE_URL_SYNC is empty. Make sure backend/.env exists and is populated.")
        return
    print(f"Connecting to: {sync_url}")

    # Read SQL migration file
    migration_file_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "migrations",
        "001_init_schema.sql"
    )

    if not os.path.exists(migration_file_path):
        print(f"Error: Migration file not found at {migration_file_path}")
        return

    with open(migration_file_path, "r", encoding="utf-8") as f:
        sql_script = f.read()

    try:
        # Establish psycopg2 connection
        conn = psycopg2.connect(sync_url)
        conn.autocommit = True
        with conn.cursor() as cursor:
            print("Executing migration script...")
            cursor.execute(sql_script)
            print("Migration script executed successfully.")
        conn.conn = None
        print("[SUCCESS] Database migration completed successfully.")
    except Exception as e:
        print(f"[ERROR] Migration failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()
