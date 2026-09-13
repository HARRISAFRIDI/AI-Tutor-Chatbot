import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Load variables from .env
load_dotenv(Path(__file__).resolve().parent / ".env")

# Get database URL
DATABASE_URL = os.getenv("DATABASE_URL")

# Create database engine
# echo=False  — avoids printing every SQL statement (reduces latency + log noise)
# pool_size   — keep 10 persistent connections ready (avoids per-request handshake)
# max_overflow — allow 5 extra connections under burst load
# pool_pre_ping — drop stale connections automatically
engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=5,
    pool_pre_ping=True,
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