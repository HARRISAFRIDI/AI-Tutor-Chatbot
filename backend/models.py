from sqlalchemy import Boolean, Column, String, DateTime, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Student(Base):
    __tablename__ = "students"
    __table_args__ = {"schema": "tutor"}

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )

    name = Column(
        String(100),
        nullable=False
    )

    email = Column(
        String(255),
        unique=True,
        nullable=False
    )

    is_admin = Column(
        Boolean,
        nullable=False,
        server_default=text("false")
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.current_timestamp()
    )


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = {"schema": "tutor"}

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )

    name = Column(
        String(200),
        nullable=False
    )

    code = Column(
        String(50)
    )

    description = Column(
        String
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.current_timestamp()
    )


class StudentCourse(Base):
    __tablename__ = "student_courses"
    __table_args__ = {"schema": "tutor"}

    student_id = Column(
        UUID(as_uuid=True),
        primary_key=True
    )

    course_id = Column(
        UUID(as_uuid=True),
        primary_key=True
    )

    enrolled_at = Column(
        DateTime(timezone=True),
        server_default=func.current_timestamp()
    )


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = {"schema": "tutor"}

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )

    course_id = Column(
        UUID(as_uuid=True),
        nullable=False
    )

    title = Column(
        String(255),
        nullable=False
    )

    file_name = Column(
        String(255)
    )

    document_type = Column(
        String(50)
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.current_timestamp()
    )