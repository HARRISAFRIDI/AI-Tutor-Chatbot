
from pathlib import Path
import tempfile
import shutil

from fastapi import FastAPI, Depends, File, Header, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
from uuid import UUID
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import Student, Course, StudentCourse
from schemas import (
    ChatRequest,
    ChatResponse,
    ChatSessionUpdate,
    SignupResponse,
    StudentCreate,
    CourseCreate,
    CourseUpdate,
    StudentUpdate,
    StudentMemoryUpdate,
    StudentMemoryResponse,
)
from memory import load_memory, save_memory
from graph import app as tutor_graph
from ingest import create_chunks, load_pdf
from embeddings import create_embedding


app = FastAPI(
    title="University AI Tutor",
    description="AI-powered university learning assistant",
    version="1.0.0"
)

app.mount(
    "/app",
    StaticFiles(directory=Path(__file__).parent.parent / "frontend", html=True),
    name="frontend"
)

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


def require_admin(
    x_admin_id: UUID = Header(...),
    db: Session = Depends(get_db)
):
    admin = db.query(Student).filter(Student.id == x_admin_id).first()

    if not admin or not admin.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    return admin


def course_payload(course, db):
    documents = db.execute(
        text("""
            SELECT count(*) AS documents,
                   coalesce(sum(chunk_count), 0) AS chunks
            FROM (
                SELECT d.id, count(dc.id) AS chunk_count
                FROM tutor.documents d
                LEFT JOIN tutor.document_chunks dc ON dc.document_id = d.id
                WHERE d.course_id = :course_id
                GROUP BY d.id
            ) document_stats
        """),
        {"course_id": course.id}
    ).mappings().one()
    return {
        "id": str(course.id),
        "name": course.name,
        "code": course.code,
        "description": course.description,
        "documents": int(documents["documents"]),
        "chunks": int(documents["chunks"])
    }


def index_document(db, document_id, pdf_path):
    course_id = db.execute(
        text("SELECT course_id FROM tutor.documents WHERE id = :document_id"),
        {"document_id": document_id}
    ).scalar_one()

    pages = load_pdf(pdf_path)
    chunks = create_chunks(pages)

    if not chunks:
        raise HTTPException(status_code=400, detail="No readable text found in the PDF")

    db.execute(
        text("DELETE FROM tutor.document_chunks WHERE document_id = :document_id"),
        {"document_id": document_id}
    )
    for index, chunk in enumerate(chunks):
        db.execute(
            text("""
                INSERT INTO tutor.document_chunks
                    (document_id, course_id, chunk_index, content, page_number, embedding)
                VALUES
                    (:document_id, CAST(:course_id AS uuid), :chunk_index, :content, :page_number, :embedding)
            """),
            {
                "document_id": document_id,
                "course_id": str(course_id),
                "chunk_index": index,
                "content": chunk["content"],
                "page_number": chunk["page_number"],
                "embedding": create_embedding(chunk["content"])
            }
        )
    return len(chunks)


@app.get("/")
def root():
    return {
        "message": "University AI Tutor API is running"
    }


@app.get("/db-test")
def database_test(db: Session = Depends(get_db)):
    students = db.query(Student).all()

    return {
        "database_connected": True,
        "student_count": len(students)
    }


# -------------------------
# Student APIs
# -------------------------

@app.post("/signup", response_model=SignupResponse)
def signup(
    student: StudentCreate,
    db: Session = Depends(get_db)
):
    existing_student = db.query(Student).filter(
        Student.email == student.email
    ).first()

    if existing_student:
        return {
            "id": existing_student.id,
            "name": existing_student.name,
            "email": existing_student.email,
            "is_admin": existing_student.is_admin
        }

    is_first_user = db.query(Student).count() == 0
    new_student = Student(
        name=student.name,
        email=student.email,
        is_admin=is_first_user
    )

    try:
        db.add(new_student)
        db.commit()
        db.refresh(new_student)
    except IntegrityError:
        db.rollback()
        existing_student = db.query(Student).filter(
            Student.email == student.email
        ).first()
        if not existing_student:
            raise HTTPException(status_code=409, detail="Signup failed")
        new_student = existing_student

    return {
        "id": new_student.id,
        "name": new_student.name,
        "email": new_student.email,
        "is_admin": new_student.is_admin
    }

@app.post("/students")
def create_student(
    student: StudentCreate,
    db: Session = Depends(get_db)
):
    new_student = Student(
        name=student.name,
        email=student.email
    )

    db.add(new_student)
    db.commit()
    db.refresh(new_student)

    return {
        "message": "Student created successfully",
        "student": {
            "id": str(new_student.id),
            "name": new_student.name,
            "email": new_student.email
        }
    }


@app.get("/students")
def get_students(
    db: Session = Depends(get_db)
):
    students = db.query(Student).all()

    return {
        "students": [
            {
                "id": str(student.id),
                "name": student.name,
                "email": student.email,
                "is_admin": student.is_admin
            }
            for student in students
        ]
    }


@app.get("/students/{student_id}")
def get_student(
    student_id: UUID,
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(
        Student.id == student_id
    ).first()

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    return {
        "id": str(student.id),
        "name": student.name,
        "email": student.email
    }


# -------------------------
# Student Memory APIs
# -------------------------

@app.get("/students/{student_id}/memory", response_model=StudentMemoryResponse)
def get_student_memory(
    student_id: UUID,
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    profile = load_memory(str(student_id), db)
    return {"student_id": str(student_id), **profile}


@app.patch("/students/{student_id}/memory", response_model=StudentMemoryResponse)
def update_student_memory(
    student_id: UUID,
    updates: StudentMemoryUpdate,
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Only pass fields that were explicitly provided (not None)
    data = {k: v for k, v in updates.model_dump().items() if v is not None}
    save_memory(str(student_id), data, db)

    profile = load_memory(str(student_id), db)
    return {"student_id": str(student_id), **profile}


# -------------------------
# Course APIs
# -------------------------

@app.post("/courses")
def create_course(
    course: CourseCreate,
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    new_course = Course(
        name=course.name,
        code=course.code,
        description=course.description
    )

    db.add(new_course)
    db.commit()
    db.refresh(new_course)

    return {
        "message": "Course created successfully",
        "course": {
            "id": str(new_course.id),
            "name": new_course.name,
            "code": new_course.code,
            "description": new_course.description
        }
    }


@app.get("/courses")
def get_courses(
    db: Session = Depends(get_db)
):
    courses = db.query(Course).order_by(Course.code.asc()).all()

    return {
        "courses": [
            {
                "id": str(course.id),
                "name": course.name,
                "code": course.code,
                "description": course.description
            }
            for course in courses
        ]
    }


@app.get("/courses/{course_id}")
def get_course(
    course_id: UUID,
    db: Session = Depends(get_db)
):
    course = db.query(Course).filter(
        Course.id == course_id
    ).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found"
        )

    return {
        "id": str(course.id),
        "name": course.name,
        "code": course.code,
        "description": course.description
    }


# -------------------------
# Enrollment APIs
# -------------------------

@app.post("/students/{student_id}/courses/{course_id}")
def enroll_student(
    student_id: UUID,
    course_id: UUID,
    db: Session = Depends(get_db)
):
    # Check if student exists
    student = db.query(Student).filter(
        Student.id == student_id
    ).first()

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    # Check if course exists
    course = db.query(Course).filter(
        Course.id == course_id
    ).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found"
        )

    # Check if already enrolled
    existing_enrollment = db.query(StudentCourse).filter(
        StudentCourse.student_id == student_id,
        StudentCourse.course_id == course_id
    ).first()

    if existing_enrollment:
        raise HTTPException(
            status_code=400,
            detail="Student is already enrolled in this course"
        )

    # Create enrollment
    enrollment = StudentCourse(
        student_id=student_id,
        course_id=course_id
    )

    db.add(enrollment)
    db.commit()

    return {
        "message": "Student enrolled successfully",
        "student_id": str(student_id),
        "course_id": str(course_id)
    }



# -------------------------
# Student Courses API
# -------------------------

@app.get("/students/{student_id}/courses")
def get_student_courses(
    student_id: UUID,
    db: Session = Depends(get_db)
):
    # Check if student exists
    student = db.query(Student).filter(
        Student.id == student_id
    ).first()

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    # Find student's enrollments
    enrollments = db.query(StudentCourse).filter(
        StudentCourse.student_id == student_id
    ).all()

    courses = []

    # Get course information
    for enrollment in enrollments:
        course = db.query(Course).filter(
            Course.id == enrollment.course_id
        ).first()

        if course:
            courses.append({
                "id": str(course.id),
                "name": course.name,
                "code": course.code,
                "description": course.description
            })

    return {
        "student_id": str(student_id),
        "courses": courses
    }


@app.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    course = db.query(Course).filter(
        Course.id == request.course_id
    ).first()

    if not course:
        raise HTTPException(status_code=404, detail="Selected course not found")

    student = db.query(Student).filter(Student.id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    session_id = request.session_id
    if session_id:
        session = db.execute(
            text("""
                SELECT id
                FROM tutor.chat_sessions
                WHERE id = :session_id
                  AND student_id = :student_id
                  AND course_id = :course_id
            """),
            {"session_id": session_id, "student_id": request.student_id, "course_id": request.course_id}
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
    else:
        session_id = db.execute(
            text("""
                INSERT INTO tutor.chat_sessions (student_id, course_id, title)
                VALUES (:student_id, :course_id, :title)
                RETURNING id
            """),
            {
                "student_id": request.student_id,
                "course_id": request.course_id,
                "title": request.question[:80]
            }
        ).scalar_one()
        db.commit()

    result = tutor_graph.invoke({
        "student_id": str(request.student_id),
        "course_id": str(request.course_id),
        "course_name": course.name,
        "question": request.question,
        "session_id": str(session_id)
    })

    return {
        "session_id": session_id,
        "answer": result.get("answer", ""),
        "answer_source": result.get("answer_source"),
        "retrieved_chunks": len(result.get("retrieved_chunks", [])),
        "retrieval_score": result.get("retrieval_score", 0.0),
        "retrieval_relevant": result.get("retrieval_relevant", False),
        "llm_call_time_seconds": result.get("llm_call_time_seconds", 0.0),
        "quality_passed": result.get("quality_passed", False),
        "message_saved": result.get("message_saved", False)
    }


@app.get("/chat-sessions")
def list_chat_sessions(
    student_id: UUID,
    course_id: UUID | None = None,
    db: Session = Depends(get_db)
):
    filters = "WHERE cs.student_id = :student_id"
    params = {"student_id": student_id}
    if course_id:
        filters += " AND cs.course_id = :course_id"
        params["course_id"] = course_id
    rows = db.execute(text(f"""
        SELECT cs.id, cs.course_id, cs.title, cs.created_at, cs.updated_at,
               count(m.id) AS message_count
        FROM tutor.chat_sessions cs
        LEFT JOIN tutor.messages m ON m.session_id = cs.id
        {filters}
        GROUP BY cs.id
        ORDER BY cs.updated_at DESC
    """), params).mappings().all()
    return {"sessions": [
        {
            "id": str(row["id"]),
            "course_id": str(row["course_id"]),
            "title": row["title"] or "Untitled session",
            "created_at": row["created_at"].isoformat(),
            "updated_at": row["updated_at"].isoformat(),
            "message_count": int(row["message_count"])
        }
        for row in rows
    ]}


@app.post("/chat-sessions")
def create_chat_session(
    student_id: UUID,
    course_id: UUID,
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    course = db.query(Course).filter(Course.id == course_id).first()
    if not student or not course:
        raise HTTPException(status_code=404, detail="Student or course not found")
    session = db.execute(text("""
        INSERT INTO tutor.chat_sessions (student_id, course_id, title)
        VALUES (:student_id, :course_id, 'New chat')
        RETURNING id, course_id, title, created_at, updated_at
    """), {"student_id": student_id, "course_id": course_id}).mappings().one()
    db.commit()
    return {"session": {
        "id": str(session["id"]),
        "course_id": str(session["course_id"]),
        "title": session["title"],
        "created_at": session["created_at"].isoformat(),
        "updated_at": session["updated_at"].isoformat(),
        "message_count": 0
    }}


@app.get("/chat-sessions/{session_id}/messages")
def get_chat_session_messages(
    session_id: UUID,
    student_id: UUID,
    db: Session = Depends(get_db)
):
    session = db.execute(text("""
        SELECT id, course_id, title
        FROM tutor.chat_sessions
        WHERE id = :session_id AND student_id = :student_id
    """), {"session_id": session_id, "student_id": student_id}).mappings().first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    messages = db.execute(text("""
        SELECT role, content, answer_source, created_at
        FROM tutor.messages
        WHERE session_id = :session_id
        ORDER BY created_at ASC
    """), {"session_id": session_id}).mappings().all()
    return {
        "session": {"id": str(session["id"]), "course_id": str(session["course_id"]), "title": session["title"]},
        "messages": [
            {"role": row["role"], "content": row["content"], "answer_source": row["answer_source"], "created_at": row["created_at"].isoformat()}
            for row in messages
        ]
    }


@app.patch("/chat-sessions/{session_id}")
def rename_chat_session(
    session_id: UUID,
    update: ChatSessionUpdate,
    student_id: UUID,
    db: Session = Depends(get_db)
):
    title = update.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Session title cannot be empty")
    result = db.execute(text("""
        UPDATE tutor.chat_sessions
        SET title = :title, updated_at = CURRENT_TIMESTAMP
        WHERE id = :session_id AND student_id = :student_id
        RETURNING id, course_id, title, created_at, updated_at
    """), {"session_id": session_id, "student_id": student_id, "title": title[:255]}).mappings().first()
    if not result:
        raise HTTPException(status_code=404, detail="Chat session not found")
    db.commit()
    return {"session": {"id": str(result["id"]), "course_id": str(result["course_id"]), "title": result["title"], "created_at": result["created_at"].isoformat(), "updated_at": result["updated_at"].isoformat()}}


@app.delete("/chat-sessions/{session_id}")
def delete_chat_session(
    session_id: UUID,
    student_id: UUID,
    db: Session = Depends(get_db)
):
    result = db.execute(text("""
        DELETE FROM tutor.chat_sessions
        WHERE id = :session_id AND student_id = :student_id
        RETURNING id
    """), {"session_id": session_id, "student_id": student_id}).first()
    if not result:
        raise HTTPException(status_code=404, detail="Chat session not found")
    db.commit()
    return {"deleted": True, "session_id": str(result[0])}


@app.post("/admin/courses")
def admin_create_course(
    course: CourseCreate,
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    existing_course = db.query(Course).filter(
        Course.code == course.code
    ).first() if course.code else None

    if existing_course:
        raise HTTPException(status_code=409, detail="Course code already exists")

    new_course = Course(
        name=course.name,
        code=course.code,
        description=course.description
    )
    db.add(new_course)
    db.commit()
    db.refresh(new_course)

    return {
        "id": str(new_course.id),
        "name": new_course.name,
        "code": new_course.code,
        "description": new_course.description,
        "created_by": str(admin.id)
    }


@app.post("/admin/courses/{course_id}/documents")
async def admin_upload_document(
    course_id: UUID,
    file: UploadFile = File(...),
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    course = db.query(Course).filter(Course.id == course_id).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The PDF file is empty")

    temporary_path = None
    stored_path = None

    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temporary_file:
            temporary_file.write(file_bytes)
            temporary_path = Path(temporary_file.name)

        document_id = db.execute(
            text("""
                INSERT INTO tutor.documents
                    (course_id, title, file_name, document_type)
                VALUES
                    (:course_id, :title, :file_name, 'pdf')
                RETURNING id
            """),
            {
                "course_id": course.id,
                "title": Path(file.filename).stem,
                "file_name": file.filename
            }
        ).scalar_one()

        stored_path = UPLOAD_DIR / f"{document_id}.pdf"
        shutil.copyfile(temporary_path, stored_path)
        chunks_indexed = index_document(db, document_id, stored_path)

        db.commit()
        return {
            "message": "PDF uploaded and indexed successfully",
            "course_id": str(course.id),
            "document_id": str(document_id),
            "chunks_indexed": chunks_indexed,
            "uploaded_by": str(admin.id)
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"PDF indexing failed: {error}")
    finally:
        if temporary_path:
            temporary_path.unlink(missing_ok=True)


@app.get("/admin/dashboard")
def admin_dashboard(
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    stats = db.execute(text("""
        SELECT
            (SELECT count(*) FROM tutor.courses) AS courses,
            (SELECT count(*) FROM tutor.documents) AS documents,
            (SELECT count(*) FROM tutor.document_chunks) AS chunks,
            (SELECT count(*) FROM tutor.students) AS students,
            (SELECT count(*) FROM tutor.conversations) +
            (SELECT count(*) FROM tutor.chat_sessions) AS conversations,
            (SELECT count(*) FROM tutor.messages) AS messages
    """)).mappings().one()
    return {
        "admin": {"id": str(admin.id), "name": admin.name, "email": admin.email},
        "stats": {key: int(value) for key, value in stats.items()},
        "rag": {"database": "online", "index": "ready" if stats["chunks"] else "empty"}
    }


@app.get("/admin/courses")
def admin_list_courses(
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return {"courses": [course_payload(course, db) for course in db.query(Course).order_by(Course.code.asc()).all()]}


@app.put("/admin/courses/{course_id}")
def admin_update_course(
    course_id: UUID,
    course_update: CourseUpdate,
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    duplicate = db.query(Course).filter(
        Course.code == course_update.code,
        Course.id != course_id
    ).first() if course_update.code else None
    if duplicate:
        raise HTTPException(status_code=409, detail="Course code already exists")
    course.name = course_update.name
    course.code = course_update.code
    course.description = course_update.description
    db.commit()
    db.refresh(course)
    return course_payload(course, db)


@app.delete("/admin/courses/{course_id}")
def admin_delete_course(
    course_id: UUID,
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    document_ids = [row[0] for row in db.execute(
        text("SELECT id FROM tutor.documents WHERE course_id = :course_id"),
        {"course_id": course_id}
    ).fetchall()]
    for document_id in document_ids:
        (UPLOAD_DIR / f"{document_id}.pdf").unlink(missing_ok=True)
    db.execute(text("DELETE FROM tutor.document_chunks WHERE document_id IN (SELECT id FROM tutor.documents WHERE course_id = :course_id)"), {"course_id": course_id})
    db.execute(text("DELETE FROM tutor.documents WHERE course_id = :course_id"), {"course_id": course_id})
    db.execute(text("DELETE FROM tutor.student_courses WHERE course_id = :course_id"), {"course_id": course_id})
    db.execute(text("DELETE FROM tutor.messages WHERE conversation_id IN (SELECT id FROM tutor.conversations WHERE course_id = :course_id)"), {"course_id": course_id})
    db.execute(text("DELETE FROM tutor.chat_sessions WHERE course_id = :course_id"), {"course_id": course_id})
    db.execute(text("DELETE FROM tutor.conversations WHERE course_id = :course_id"), {"course_id": course_id})
    db.delete(course)
    db.commit()
    return {"message": "Course deleted", "course_id": str(course_id)}


@app.get("/admin/courses/{course_id}/documents")
def admin_list_documents(
    course_id: UUID,
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    documents = db.execute(text("""
        SELECT d.id, d.title, d.file_name, d.created_at, count(dc.id) AS chunks
        FROM tutor.documents d
        LEFT JOIN tutor.document_chunks dc ON dc.document_id = d.id
        WHERE d.course_id = :course_id
        GROUP BY d.id
        ORDER BY d.created_at DESC
    """), {"course_id": course_id}).mappings().all()
    return {"documents": [
        {"id": str(row["id"]), "title": row["title"], "file_name": row["file_name"],
         "created_at": row["created_at"].isoformat() if row["created_at"] else None,
         "chunks": int(row["chunks"]),
         "reindex_available": (UPLOAD_DIR / f"{row['id']}.pdf").exists()}
        for row in documents
    ]}


@app.post("/admin/documents/{document_id}/reindex")
def admin_reindex_document(
    document_id: UUID,
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    path = UPLOAD_DIR / f"{document_id}.pdf"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Original PDF is not stored for this lecture")
    chunks = index_document(db, document_id, path)
    db.commit()
    return {"message": "Lecture re-indexed", "chunks_indexed": chunks}


@app.put("/admin/documents/{document_id}")
async def admin_replace_document(
    document_id: UUID,
    file: UploadFile = File(...),
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    document = db.execute(text("SELECT id FROM tutor.documents WHERE id = :document_id"), {"document_id": document_id}).first()
    if not document:
        raise HTTPException(status_code=404, detail="Lecture not found")
    path = UPLOAD_DIR / f"{document_id}.pdf"
    path.write_bytes(await file.read())
    db.execute(text("UPDATE tutor.documents SET title=:title, file_name=:file_name WHERE id=:document_id"), {"title": Path(file.filename).stem, "file_name": file.filename, "document_id": document_id})
    chunks = index_document(db, document_id, path)
    db.commit()
    return {"message": "Lecture replaced and indexed", "chunks_indexed": chunks}


@app.delete("/admin/documents/{document_id}")
def admin_delete_document(
    document_id: UUID,
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    document = db.execute(text("SELECT id FROM tutor.documents WHERE id = :document_id"), {"document_id": document_id}).first()
    if not document:
        raise HTTPException(status_code=404, detail="Lecture not found")
    db.execute(text("DELETE FROM tutor.document_chunks WHERE document_id = :document_id"), {"document_id": document_id})
    db.execute(text("DELETE FROM tutor.documents WHERE id = :document_id"), {"document_id": document_id})
    db.commit()
    (UPLOAD_DIR / f"{document_id}.pdf").unlink(missing_ok=True)
    return {"message": "Lecture deleted"}


@app.get("/admin/students")
def admin_list_students(
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    rows = db.execute(text("""
        SELECT s.id, s.name, s.email, s.is_admin, s.created_at,
             count(DISTINCT cv.id) + count(DISTINCT cs.id) AS conversations,
               count(DISTINCT m.id) AS messages
        FROM tutor.students s
        LEFT JOIN tutor.conversations cv ON cv.student_id = s.id
         LEFT JOIN tutor.chat_sessions cs ON cs.student_id = s.id
         LEFT JOIN tutor.messages m ON m.conversation_id = cv.id OR m.session_id = cs.id
        GROUP BY s.id
        ORDER BY s.created_at ASC
    """)).mappings().all()
    return {"students": [
        {"id": str(row["id"]), "name": row["name"], "email": row["email"], "is_admin": row["is_admin"],
         "created_at": row["created_at"].isoformat() if row["created_at"] else None,
         "conversations": int(row["conversations"]), "messages": int(row["messages"])}
        for row in rows
    ]}


@app.get("/admin/students/{student_id}/progress")
def admin_student_progress(
    student_id: UUID,
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    row = db.execute(text("""
         SELECT s.name, s.email, count(DISTINCT cv.id) + count(DISTINCT cs.id) AS conversations,
               count(m.id) AS messages, max(m.created_at) AS last_activity
        FROM tutor.students s
        LEFT JOIN tutor.conversations cv ON cv.student_id = s.id
         LEFT JOIN tutor.chat_sessions cs ON cs.student_id = s.id
         LEFT JOIN tutor.messages m ON m.conversation_id = cv.id OR m.session_id = cs.id
        WHERE s.id = :student_id
        GROUP BY s.id
    """), {"student_id": student_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"student": {"name": row["name"], "email": row["email"], "conversations": int(row["conversations"]), "messages": int(row["messages"]), "last_activity": row["last_activity"].isoformat() if row["last_activity"] else None}}


@app.patch("/admin/students/{student_id}")
def admin_manage_student(
    student_id: UUID,
    update: StudentUpdate,
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.name = update.name
    student.email = update.email
    if student.id == admin.id:
        student.is_admin = True
    else:
        student.is_admin = update.is_admin
    db.commit()
    return {"id": str(student.id), "name": student.name, "email": student.email, "is_admin": student.is_admin}


@app.get("/admin/activity")
def admin_activity(
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    rows = db.execute(text("""
        SELECT m.created_at, m.role, left(m.content, 120) AS content,
               s.name AS student_name, c.code AS course_code
        FROM tutor.messages m
        LEFT JOIN tutor.conversations cv ON cv.id = m.conversation_id
        LEFT JOIN tutor.chat_sessions cs ON cs.id = m.session_id
        JOIN tutor.students s ON s.id = COALESCE(cv.student_id, cs.student_id)
        JOIN tutor.courses c ON c.id = COALESCE(cv.course_id, cs.course_id)
        ORDER BY m.created_at DESC
        LIMIT 50
    """)).mappings().all()
    return {"activity": [
        {
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "role": row["role"],
            "content": row["content"],
            "student_name": row["student_name"],
            "course_code": row["course_code"]
        }
        for row in rows
    ]}


@app.get("/admin/all-documents")
def admin_list_all_documents(
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    documents = db.execute(text("""
        SELECT d.id, d.title, d.file_name, d.created_at, d.course_id,
               c.name AS course_name, c.code AS course_code,
               count(dc.id) AS chunks
        FROM tutor.documents d
        JOIN tutor.courses c ON c.id = d.course_id
        LEFT JOIN tutor.document_chunks dc ON dc.document_id = d.id
        GROUP BY d.id, c.id
        ORDER BY d.created_at DESC
    """)).mappings().all()
    return {"documents": [
        {
            "id": str(row["id"]),
            "title": row["title"],
            "file_name": row["file_name"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "course_id": str(row["course_id"]),
            "course_name": row["course_name"],
            "course_code": row["course_code"] or "",
            "chunks": int(row["chunks"]),
            "reindex_available": (UPLOAD_DIR / f"{row['id']}.pdf").exists()
        }
        for row in documents
    ]}


@app.get("/admin/enrollments")
def admin_list_enrollments(
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    rows = db.execute(text("""
        SELECT sc.student_id, sc.course_id, sc.created_at,
               s.name AS student_name, s.email AS student_email,
               c.name AS course_name, c.code AS course_code
        FROM tutor.student_courses sc
        JOIN tutor.students s ON s.id = sc.student_id
        JOIN tutor.courses c ON c.id = sc.course_id
        ORDER BY sc.created_at DESC
    """)).mappings().all()
    return {"enrollments": [
        {
            "student_id": str(row["student_id"]),
            "course_id": str(row["course_id"]),
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "student_name": row["student_name"],
            "student_email": row["student_email"],
            "course_name": row["course_name"],
            "course_code": row["course_code"] or ""
        }
        for row in rows
    ]}


@app.post("/admin/enrollments")
def admin_create_enrollment(
    payload: dict,
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    student_id = payload.get("student_id")
    course_id = payload.get("course_id")
    if not student_id or not course_id:
        raise HTTPException(status_code=400, detail="student_id and course_id required")

    existing = db.query(StudentCourse).filter(
        StudentCourse.student_id == student_id,
        StudentCourse.course_id == course_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student is already enrolled in this course")

    enrollment = StudentCourse(student_id=student_id, course_id=course_id)
    db.add(enrollment)
    db.commit()
    return {"message": "Enrollment created", "student_id": student_id, "course_id": course_id}


@app.delete("/admin/enrollments/{student_id}/{course_id}")
def admin_delete_enrollment(
    student_id: UUID,
    course_id: UUID,
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    existing = db.query(StudentCourse).filter(
        StudentCourse.student_id == student_id,
        StudentCourse.course_id == course_id
    ).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    db.delete(existing)
    db.commit()
    return {"message": "Enrollment removed"}


@app.get("/admin/rag/stats")
def admin_rag_stats(
    admin: Student = Depends(require_admin),
    db: Session = Depends(get_db)
):
    stats = db.execute(text("""
        SELECT
            (SELECT count(*) FROM tutor.documents) AS documents,
            (SELECT count(*) FROM tutor.document_chunks) AS total_chunks,
            (SELECT count(*) FROM tutor.messages WHERE role = 'assistant') AS total_rag_queries,
            (SELECT count(*) FROM tutor.messages WHERE role = 'assistant' AND answer_source = 'rag') AS rag_sourced_queries
    """)).mappings().one()

    return {
        "llm_model": "gemini-3.6-flash",
        "embedding_model": "gemini-embedding-001",
        "vector_dimension": 1536,
        "database_engine": "PostgreSQL + pgvector (HNSW Index)",
        "similarity_metric": "Cosine Similarity",
        "retrieval_k": 4,
        "total_documents": int(stats["documents"]),
        "total_chunks": int(stats["total_chunks"]),
        "total_rag_queries": int(stats["total_rag_queries"]),
        "rag_sourced_queries": int(stats["rag_sourced_queries"]),
        "health_status": "Healthy"
    }


# In-memory system settings cache
ADMIN_SETTINGS = {
    "system_name": "University AI Tutor System",
    "university_name": "State University",
    "max_upload_size_mb": 25,
    "ai_temperature": 0.1,
    "ai_max_tokens": 1024,
    "rag_similarity_threshold": 0.75,
    "rag_max_chunks": 4,
    "session_timeout_minutes": 60,
    "allow_new_registrations": True,
}


@app.get("/admin/settings")
def admin_get_settings(
    admin: Student = Depends(require_admin),
):
    return {"settings": ADMIN_SETTINGS}


@app.post("/admin/settings")
def admin_update_settings(
    payload: dict,
    admin: Student = Depends(require_admin),
):
    ADMIN_SETTINGS.update(payload)
    return {"message": "Settings updated", "settings": ADMIN_SETTINGS}


FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="static")
