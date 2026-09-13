import React, { useState } from 'react'
import type { AdminSystemSettings } from '../../types'

interface SettingsViewProps {
  settings: AdminSystemSettings | null
  loading: boolean
  onSaveSettings: (settings: Partial<AdminSystemSettings>) => Promise<void>
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  loading,
  onSaveSettings,
}) => {
  const [systemName, setSystemName] = useState(settings?.system_name || 'University AI Tutor System')
  const [universityName, setUniversityName] = useState(settings?.university_name || 'State University')
  const [maxUploadSize, setMaxUploadSize] = useState(settings?.max_upload_size_mb || 25)
  const [temperature, setTemperature] = useState(settings?.ai_temperature || 0.1)
  const [maxTokens, setMaxTokens] = useState(settings?.ai_max_tokens || 1024)
  const [threshold, setThreshold] = useState(settings?.rag_similarity_threshold || 0.75)
  const [maxChunks, setMaxChunks] = useState(settings?.rag_max_chunks || 4)
  const [timeout, setTimeoutVal] = useState(settings?.session_timeout_minutes || 60)
  const [allowRegister, setAllowRegister] = useState(settings?.allow_new_registrations ?? true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSaveSettings({
      system_name: systemName,
      university_name: universityName,
      max_upload_size_mb: Number(maxUploadSize),
      ai_temperature: Number(temperature),
      ai_max_tokens: Number(maxTokens),
      rag_similarity_threshold: Number(threshold),
      rag_max_chunks: Number(maxChunks),
      session_timeout_minutes: Number(timeout),
      allow_new_registrations: allowRegister,
    })
  }

  return (
    <div className="admin-view-container">
      <form onSubmit={handleSubmit}>
        <div className="view-header-banner mb-6">
          <div>
            <h2>⚙️ System & AI Configuration Settings</h2>
            <p className="subtitle">
              Manage platform branding, LLM hyperparameters, vector search thresholds, and security policies.
            </p>
          </div>
          <div className="banner-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving Changes...' : '💾 Save Settings'}
            </button>
          </div>
        </div>

        <div className="dashboard-panels-grid">
          {/* GENERAL SETTINGS */}
          <div className="admin-card">
            <div className="card-header">
              <h3>🏛️ General System Settings</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label>System Platform Title</label>
                <input
                  type="text"
                  value={systemName}
                  onChange={(e) => setSystemName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>University Institution Name</label>
                <input
                  type="text"
                  value={universityName}
                  onChange={(e) => setUniversityName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Max PDF Upload Size (MB)</label>
                <input
                  type="number"
                  value={maxUploadSize}
                  onChange={(e) => setMaxUploadSize(Number(e.target.value))}
                  min={1}
                  max={100}
                />
              </div>
            </div>
          </div>

          {/* AI MODEL CONFIGURATION */}
          <div className="admin-card">
            <div className="card-header">
              <h3>🤖 AI Model & Hyperparameters</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label>Active Generative AI Model</label>
                <input type="text" value="gemini-3.6-flash" disabled className="bg-disabled" />
                <p className="field-hint">Fixed to Google Gemini 3.6 Flash high-performance model.</p>
              </div>

              <div className="form-group">
                <label>Temperature (Sampling Randomness): {temperature}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Max Output Tokens Cap</label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  min={128}
                  max={4096}
                />
              </div>
            </div>
          </div>

          {/* RAG VECTOR CONFIGURATION */}
          <div className="admin-card">
            <div className="card-header">
              <h3>⚡ RAG Vector Store Parameters</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label>Active Embedding Model</label>
                <input type="text" value="gemini-embedding-001" disabled className="bg-disabled" />
              </div>

              <div className="form-group">
                <label>Cosine Similarity Threshold: {threshold}</label>
                <input
                  type="range"
                  min="0.5"
                  max="0.95"
                  step="0.05"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Max Retrieved Document Chunks (K)</label>
                <input
                  type="number"
                  value={maxChunks}
                  onChange={(e) => setMaxChunks(Number(e.target.value))}
                  min={1}
                  max={10}
                />
              </div>
            </div>
          </div>

          {/* SECURITY & SESSION POLICY */}
          <div className="admin-card">
            <div className="card-header">
              <h3>🔒 Security & Governance</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label>Student Session Inactivity Timeout (Minutes)</label>
                <input
                  type="number"
                  value={timeout}
                  onChange={(e) => setTimeoutVal(Number(e.target.value))}
                  min={15}
                  max={1440}
                />
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={allowRegister}
                    onChange={(e) => setAllowRegister(e.target.checked)}
                  />
                  <span>Allow New Student Self-Registrations</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
