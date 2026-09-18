import os
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit, urlunsplit

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Load variables from .env
load_dotenv(Path(__file__).resolve().parent / ".env")

# Get the cloud database URL. The application intentionally has no local
# PostgreSQL fallback: a missing or local URL must fail during startup.
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required and must point to Supabase PostgreSQL")

scheme, separator, remainder = DATABASE_URL.partition("://")
if not separator:
    raise RuntimeError("DATABASE_URL must be a PostgreSQL connection URL")

authority, path_separator, path = remainder.partition("/")
if "@" in authority and ":" in authority.split("@", 1)[0]:
    user_info, host_port = authority.rsplit("@", 1)
    username, password = user_info.split(":", 1)
    authority = f"{quote(unquote(username), safe='')}:{quote(unquote(password), safe='')}@{host_port}"

DATABASE_URL = f"{scheme}://{authority}{path_separator}{path}"
parsed_url = urlsplit(DATABASE_URL)
if parsed_url.scheme in {"postgresql", "postgres"}:
    DATABASE_URL = urlunsplit(("postgresql+psycopg", parsed_url.netloc, parsed_url.path, parsed_url.query, parsed_url.fragment))
elif parsed_url.scheme != "postgresql+psycopg":
    raise RuntimeError("DATABASE_URL must use a PostgreSQL URL supported by psycopg")

database_host = (parsed_url.hostname or "").lower()
if database_host in {"localhost", "127.0.0.1", "::1"}:
    raise RuntimeError("DATABASE_URL must point to Supabase PostgreSQL, not a local database")

# Create database engine
# Keep the pool conservative for Supabase connection limits while reusing
# healthy cloud connections across FastAPI requests.
engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
    pool_recycle=1800,
    max_overflow=5,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 10, "sslmode": "require"},
)

# Create database session
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False
)


# Database session dependency
def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()