from pathlib import Path
from uuid import UUID

from sqlalchemy import text
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from database import SessionLocal
from embeddings import create_embedding


PDF_FOLDER = Path("documents/database")


# --------------------------------------------------
# PDF LOADING
# --------------------------------------------------

def load_pdf(pdf_path):

    reader = PdfReader(pdf_path)

    pages = []

    for page_number, page in enumerate(reader.pages, start=1):

        text_content = page.extract_text()

        if text_content:

            pages.append({
                "page_number": page_number,
                "text": text_content
            })

    return pages


# --------------------------------------------------
# TEXT CHUNKING
# --------------------------------------------------

def create_chunks(pages):

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150
    )

    chunks = []

    for page in pages:

        page_chunks = splitter.split_text(
            page["text"]
        )

        for chunk in page_chunks:

            chunks.append({
                "content": chunk,
                "page_number": page["page_number"]
            })

    return chunks


# --------------------------------------------------
# GET OR CREATE COURSE
# --------------------------------------------------

def get_or_create_course(db):

    result = db.execute(
        text("""
            SELECT id
            FROM tutor.courses
            WHERE code = :code
            LIMIT 1
        """),
        {
            "code": "DB"
        }
    ).fetchone()

    if result:

        return result[0]

    result = db.execute(
        text("""
            INSERT INTO tutor.courses
                (name, code, description)
            VALUES
                (:name, :code, :description)
            RETURNING id
        """),
        {
            "name": "Database Systems",
            "code": "DB",
            "description": "Database Systems university lecture material"
        }
    ).fetchone()

    db.commit()

    return result[0]


# --------------------------------------------------
# CREATE DOCUMENT
# --------------------------------------------------

def create_document(db, course_id, pdf_path):

    result = db.execute(
        text("""
            INSERT INTO tutor.documents
                (
                    course_id,
                    title,
                    file_name,
                    document_type
                )
            VALUES
                (
                    :course_id,
                    :title,
                    :file_name,
                    :document_type
                )
            RETURNING id
        """),
        {
            "course_id": course_id,
            "title": pdf_path.stem,
            "file_name": pdf_path.name,
            "document_type": "pdf"
        }
    ).fetchone()

    db.commit()

    return result[0]


# --------------------------------------------------
# SAVE CHUNKS + EMBEDDINGS
# --------------------------------------------------

def save_chunks(db, document_id, chunks, course_id=None):
    """Insert chunks with embeddings.

    course_id is stored directly on each row (migration 006) so that
    retrieval.py can filter by course without a JOIN to tutor.documents.
    Pass it whenever the caller knows the course; existing call-sites that
    omit it will still work (the column allows NULL until migration 006
    backfills existing rows).
    """
    for index, chunk in enumerate(chunks):

        print(
            f"Creating embedding "
            f"{index + 1}/{len(chunks)}..."
        )

        vector = create_embedding(
            chunk["content"]
        )

        db.execute(
            text("""
                INSERT INTO tutor.document_chunks
                (
                    document_id,
                    course_id,
                    chunk_index,
                    content,
                    page_number,
                    embedding
                )
                VALUES
                (
                    :document_id,
                    CAST(:course_id AS uuid),
                    :chunk_index,
                    :content,
                    :page_number,
                    :embedding
                )
            """),
            {
                "document_id": document_id,
                "course_id": str(course_id) if course_id else None,
                "chunk_index": index,
                "content": chunk["content"],
                "page_number": chunk["page_number"],
                "embedding": vector,
            }
        )

    db.commit()



def main():

    db = SessionLocal()

    try:

        pdf_files = list(
            PDF_FOLDER.glob("*.pdf")
        )

        print("PDFs found:", len(pdf_files))

        if not pdf_files:

            print("No PDF files found.")

            return

        # Get Database Systems course
        course_id = get_or_create_course(db)

        print("Course ID:", course_id)

        for pdf_path in pdf_files:

            print("\n==============================")
            print("Processing:", pdf_path.name)
            print("==============================")

            # Load PDF
            pages = load_pdf(pdf_path)

            print("Pages:", len(pages))

            # Create chunks
            chunks = create_chunks(pages)

            print("Chunks:", len(chunks))

            # Create document record
            document_id = create_document(
                db,
                course_id,
                pdf_path
            )

            print("Document ID:", document_id)

            # Generate embeddings + save (pass course_id for fast retrieval)
            save_chunks(
                db,
                document_id,
                chunks,
                course_id=course_id,
            )

            print("Document stored successfully!")

        print("\n================================")
        print("INGESTION COMPLETED")
        print("================================")

    except Exception as e:

        db.rollback()

        print("\nERROR:")
        print(e)

    finally:

        db.close()


if __name__ == "__main__":
    main()