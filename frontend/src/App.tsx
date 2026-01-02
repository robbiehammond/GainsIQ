import React, { useEffect, useState } from 'react'

type AppConfig = {
  apiBaseUrl: string
  env?: string
}

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/config.json')
      .then(async (r) => {
        if (!r.ok) throw new Error(`config fetch failed: ${r.status}`)
        return r.json()
      })
      .then(setConfig)
      .catch((e) => setError(String(e)))
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial', padding: 16 }}>
      <h1>GainsIQ</h1>
      {!config && !error && <p>Loading config…</p>}
      {error && (
        <p style={{ color: 'crimson' }}>Failed to load config.json: {error}</p>
      )}
      {config && (
        <div>
          <p>Environment: {config.env ?? 'unknown'}</p>
          <p>API Base URL: {config.apiBaseUrl}</p>
        </div>
      )}
      <p style={{ marginTop: 24, color: '#666' }}>Minimal scaffold. We’ll add pages next.</p>
    </div>
  )
}

