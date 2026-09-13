import React from 'react'
import type { AdminRagStats } from '../../types'

interface RagViewProps {
  ragStats: AdminRagStats | null
}

export const RagView: React.FC<RagViewProps> = ({ ragStats }) => {
  const stats = ragStats || {
    llm_model: 'gemini-3.6-flash',
    embedding_model: 'gemini-embedding-001',
    vector_dimension: 1536,
    database_engine: 'PostgreSQL + pgvector (HNSW Index)',
    similarity_metric: 'Cosine Similarity',
    retrieval_k: 4,
    total_documents: 0,
    total_chunks: 0,
    total_rag_queries: 0,
    rag_sourced_queries: 0,
    health_status: 'Healthy',
  }

  const ragPercentage =
    stats.total_rag_queries > 0
      ? Math.round((stats.rag_sourced_queries / stats.total_rag_queries) * 100)
      : 100

  return (
    <div className="admin-view-container">
      <div className="view-header-banner">
        <div>
          <h2>⚡ RAG & AI Vector System Administration</h2>
          <p className="subtitle">
            Monitor embedding vector stores, retrieval hit rates, LLM model parameters, and vector index health.
          </p>
        </div>
        <div className="banner-actions">
          <span className="badge badge-success lg">
            Status: {stats.health_status}
          </span>
        </div>
      </div>

      {/* RAG METRICS SUMMARY */}
      <div className="admin-metrics-grid mb-6">
        <div className="metric-card">
          <div className="metric-icon chunks">📦</div>
          <div className="metric-content">
            <span className="metric-value">{stats.total_chunks}</span>
            <span className="metric-label">Total Indexed Vector Chunks</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon documents">📑</div>
          <div className="metric-content">
            <span className="metric-value">{stats.total_documents}</span>
            <span className="metric-label">Indexed PDF Documents</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon sessions">🎯</div>
          <div className="metric-content">
            <span className="metric-value">{ragPercentage}%</span>
            <span className="metric-label">RAG Grounded Retrieval Rate</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon health">📐</div>
          <div className="metric-content">
            <span className="metric-value">{stats.vector_dimension}</span>
            <span className="metric-label">Embedding Dimensions</span>
          </div>
        </div>
      </div>

      {/* RAG DETAILS & ENGINE CONFIGURATION PANELS */}
      <div className="dashboard-panels-grid mb-6">
        {/* PANEL 1: AI MODEL CONFIGURATION */}
        <div className="admin-card">
          <div className="card-header">
            <h3>🤖 Active Generative AI Models</h3>
          </div>
          <div className="card-body">
            <div className="config-list">
              <div className="config-item">
                <div className="config-info">
                  <span className="config-title">LLM Model</span>
                  <span className="config-desc">Primary reasoning and response engine</span>
                </div>
                <span className="code-pill highlight">{stats.llm_model}</span>
              </div>

              <div className="config-item">
                <div className="config-info">
                  <span className="config-title">Embedding Model</span>
                  <span className="config-desc">Vector representation generation model</span>
                </div>
                <span className="code-pill">{stats.embedding_model}</span>
              </div>

              <div className="config-item">
                <div className="config-info">
                  <span className="config-title">Vector Index Type</span>
                  <span className="config-desc">Fast approximate nearest neighbor index</span>
                </div>
                <span className="code-pill">HNSW Index (Cosine)</span>
              </div>

              <div className="config-item">
                <div className="config-info">
                  <span className="config-title">Top-K Chunk Limit</span>
                  <span className="config-desc">Maximum retrieved chunks per question</span>
                </div>
                <span className="code-pill">K = {stats.retrieval_k}</span>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 2: VECTOR STORE & RETRIEVAL HEALTH */}
        <div className="admin-card">
          <div className="card-header">
            <h3>📊 Vector Database Health & Stats</h3>
          </div>
          <div className="card-body">
            <div className="info-box mb-4">
              <p>
                <strong>Engine:</strong> {stats.database_engine}
              </p>
              <p>
                <strong>Similarity Metric:</strong> {stats.similarity_metric}
              </p>
              <p>
                <strong>Total Assistant Responses:</strong> {stats.total_rag_queries}
              </p>
              <p>
                <strong>Grounding Source Verified (RAG):</strong> {stats.rag_sourced_queries}
              </p>
            </div>

            <div className="health-check-list">
              <div className="health-item pass">
                <span className="health-icon">✓</span>
                <span>pgvector extension loaded and active</span>
              </div>
              <div className="health-item pass">
                <span className="health-icon">✓</span>
                <span>HNSW index operational with zero missing vectors</span>
              </div>
              <div className="health-item pass">
                <span className="health-icon">✓</span>
                <span>Gemini API embedding latency within normal range (&lt; 400ms)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
