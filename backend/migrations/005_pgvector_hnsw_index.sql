-- ============================================================
-- Migration 005: Add HNSW index on document_chunks.embedding
-- ============================================================
-- 
-- WHY this index is required
-- ---------------------------
-- Without an index, every pgvector similarity query performs a
-- full sequential scan of ALL rows in document_chunks, computing
-- the cosine distance for every embedding regardless of course.
-- With thousands of chunks this becomes the dominant bottleneck.
--
-- HNSW (Hierarchical Navigable Small World) is the recommended
-- index type for pgvector ≥ 0.5:
--   - Query time: O(log N) vs O(N) sequential scan
--   - Approximate nearest-neighbour with high recall (>95%)
--   - No need to specify list count upfront (unlike IVFFlat)
--   - CONCURRENTLY = no table lock, safe on a live database
--
-- Parameters
-- ----------
--   m               = 16   (max connections per node; 16 is the recommended default)
--   ef_construction = 64   (higher = better recall during build, 64 is a good balance)
--
-- After creation, to tune query recall at runtime:
--   SET hnsw.ef_search = 100;   -- higher = slower but more accurate
-- ============================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_doc_chunks_embedding_hnsw
    ON tutor.document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Also ensure the document_id FK has an index so the JOIN on
-- documents is fast (this is usually created automatically by
-- the FK constraint, but we add it explicitly to be safe).
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_doc_chunks_document_id
    ON tutor.document_chunks (document_id);
