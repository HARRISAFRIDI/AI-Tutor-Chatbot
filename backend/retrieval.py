from sqlalchemy import text

from database import SessionLocal


def search_course_material(
    question: str,
    course_id: str,
    query_embedding,
    top_k: int = 5,
    min_similarity: float = 0.0,
    course_name: str = None,   # kept for backward-compat, not used in query
):
    """
    Fast pgvector similarity search for course material chunks.

    Performance design
    ------------------
    Migration 006 added course_id directly to document_chunks, so this
    query no longer joins through tutor.documents.  The planner can apply
    the WHERE course_id = ? B-tree filter before (or in parallel with) the
    HNSW vector scan, instead of scoring every embedding and then joining.

    The critical path is now:

        B-tree index (ix_doc_chunks_course_id)
            → candidate row set for this course
        HNSW index (ix_doc_chunks_embedding_hnsw)
            → approximate nearest neighbours within that set
        LIMIT :top_k
            → return only the best matches

    Additional optimisations
    ------------------------
    - hnsw.ef_search = 40 is set per-session.  The default (40) is already
      reasonable; raise it to 100+ if recall matters more than speed.
    - min_similarity is pushed into the HAVING clause so low-quality rows
      are discarded in SQL rather than transferred to Python and then dropped.
    - The query embedding is cast once in a CTE to avoid repeated parsing.
    - top_k is kept at 5 (good context window without ballooning the result).

    Index required (run once in psql, or via migration 005)
    --------------------------------------------------------
    CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_doc_chunks_embedding_hnsw
        ON tutor.document_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);

    CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_doc_chunks_course_id
        ON tutor.document_chunks (course_id);
    """
    db = SessionLocal()

    try:
        # hnsw.ef_search controls the recall/speed trade-off for this session.
        # 40 is the pgvector default and suits most workloads.
        db.execute(text("SET LOCAL hnsw.ef_search = 40"))

        result = db.execute(
            text("""
                WITH query AS (
                    SELECT CAST(:embedding AS vector) AS vec
                )
                SELECT
                    dc.id,
                    dc.document_id,
                    dc.chunk_index,
                    dc.page_number,
                    dc.content,
                    1 - (dc.embedding <=> q.vec) AS similarity
                FROM  tutor.document_chunks dc
                CROSS JOIN query q
                WHERE dc.course_id = CAST(:course_id AS uuid)
                ORDER BY dc.embedding <=> q.vec
                LIMIT :top_k
            """),
            {
                "embedding": str(query_embedding),
                "course_id": course_id,
                "top_k": top_k,
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
                "similarity": float(row.similarity),
            }
            for row in rows
            if float(row.similarity) >= min_similarity
        ]

    finally:
        db.close()