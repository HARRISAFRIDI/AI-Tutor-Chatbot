"""Read-only connectivity and schema checks for the Supabase database."""

from sqlalchemy import text

from database import SessionLocal


REQUIRED_TABLES = (
    "students",
    "courses",
    "student_courses",
    "documents",
    "document_chunks",
    "conversations",
    "chat_sessions",
    "messages",
    "student_memory",
)


def run_checks() -> bool:
    checks: list[tuple[str, bool, str]] = []
    db = SessionLocal()

    try:
        checks.append(("Database connection", db.execute(text("SELECT 1")).scalar_one() == 1, "SELECT 1"))
        version = db.execute(text("SELECT version()")).scalar_one()
        checks.append(("PostgreSQL", bool(version), version.split(",", 1)[0]))

        vector_extension = db.execute(text("""
            SELECT EXISTS (
                SELECT 1 FROM pg_extension WHERE extname = 'vector'
            )
        """)).scalar_one()
        checks.append(("pgvector", bool(vector_extension), "extension installed" if vector_extension else "extension missing"))

        table_rows = db.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'tutor'
              AND table_name = ANY(:table_names)
        """), {"table_names": list(REQUIRED_TABLES)}).scalars().all()
        existing_tables = set(table_rows)
        for table_name in REQUIRED_TABLES:
            checks.append((f"Table tutor.{table_name}", table_name in existing_tables, "found" if table_name in existing_tables else "missing"))

        vector_definition = db.execute(text("""
            SELECT format_type(a.atttypid, a.atttypmod)
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'tutor'
              AND c.relname = 'document_chunks'
              AND a.attname = 'embedding'
              AND NOT a.attisdropped
        """)).scalar_one_or_none()
        checks.append(("Vector column", vector_definition == "vector(1536)", vector_definition or "missing"))
    except Exception as error:
        checks.append(("Database checks", False, f"{type(error).__name__}: {error}"))
    finally:
        db.close()

    print("# ========================================")
    print("SUPABASE DATABASE TEST")
    for name, passed, detail in checks:
        status = "SUCCESS" if passed else "FAILED"
        print(f"{name}: {status} ({detail})")
    print("# ========================================")

    passed = all(result[1] for result in checks)
    print("SUPABASE CONNECTION READY" if passed else "SUPABASE CONNECTION NOT READY")
    return passed


if __name__ == "__main__":
    raise SystemExit(0 if run_checks() else 1)
