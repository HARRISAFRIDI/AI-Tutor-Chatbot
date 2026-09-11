from sqlalchemy import text

from database import SessionLocal
from embeddings import create_embedding


def search_course_material(
    question: str,
    course_id: str,
    course_name: str,
    top_k: int = 5
):
    db = SessionLocal()

    try:
        query_embedding = create_embedding(question)

        result = db.execute(
            text("""
                SELECT
                    dc.id,
                    dc.document_id,
                    dc.chunk_index,
                    dc.page_number,
                    dc.content,
                    1 - (
                        dc.embedding <=> CAST(:embedding AS vector)
                    ) AS similarity
                FROM tutor.document_chunks dc
                JOIN tutor.documents d
                    ON dc.document_id = d.id
                                JOIN tutor.courses c
                                        ON d.course_id = c.id
                                WHERE d.course_id = CAST(:course_id AS uuid)
                                    AND c.name = :course_name
                ORDER BY dc.embedding <=> CAST(:embedding AS vector)
                LIMIT :top_k
            """),
            {
                "embedding": str(query_embedding),
                "course_id": course_id,
                "course_name": course_name,
                "top_k": top_k
            }
        )

        rows = result.fetchall()

        return [
            {
                "id": str(row.id),
                "document_id": str(row.document_id),
                "chunk_index": row.chunk_index,
                "page_number": row.page_number,
                "content": row.content,
                "similarity": float(row.similarity)
            }
            for row in rows
        ]

    finally:
        db.close()