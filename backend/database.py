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
engine = create_engine(
    DATABASE_URL,
    echo=True
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