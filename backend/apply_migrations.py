"""Apply the ordered SQL migrations to the configured Supabase database."""

from pathlib import Path
import re

from database import engine


MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


def migration_statements(sql: str) -> list[str]:
    without_comments = re.sub(r"--[^\n]*", "", sql)
    return [statement.strip() for statement in without_comments.split(";") if statement.strip()]


def apply_migrations() -> None:
    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not migration_files:
        raise RuntimeError("No migration files found")

    with engine.connect() as connection:
        raw_connection = connection.connection.driver_connection
        raw_connection.autocommit = True
        with raw_connection.cursor() as cursor:
            for migration_file in migration_files:
                print(f"Applying {migration_file.name}...")
                for statement in migration_statements(migration_file.read_text(encoding="utf-8")):
                    cursor.execute(statement)
                print(f"Applied {migration_file.name}")


if __name__ == "__main__":
    apply_migrations()
    print("All Supabase migrations applied successfully.")
