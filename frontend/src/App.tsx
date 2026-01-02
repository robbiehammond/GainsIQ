import React, { useEffect, useState } from 'react'
import { GainsIQApiClient } from './api'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'

type AppConfig = {
  apiBaseUrl: string
  env?: string
}

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string | null>(null)

  useEffect(() => {
    const override = localStorage.getItem('gainsiq.apiBaseUrlOverride')
    // Prefer explicit local override
    if (override) {
      setConfig({ apiBaseUrl: override, env: 'local-override' })
      return
    }
    // In dev, allow .env local injection via Vite
    const envApi = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined
    // Prefer Vite env if defined in any mode (dev/preview/build)
    if (envApi) {
      setConfig({ apiBaseUrl: envApi, env: 'env' })
      return
    }
    // Otherwise, fetch runtime config (S3/site)
    fetch('/config.json')
      .then(async (r) => {
        if (!r.ok) throw new Error(`config fetch failed: ${r.status}`)
        return r.json()
      })
      .then(setConfig)
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('gainsiq.apiKey')
    if (saved) setApiKey(saved)
  }, [])

  const handleLoggedIn = (key: string) => {
    localStorage.setItem('gainsiq.apiKey', key)
    setApiKey(key)
  }

  const handleLogout = () => {
    localStorage.removeItem('gainsiq.apiKey')
    setApiKey(null)
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial', padding: 16 }}>
      <h1>GainsIQ</h1>
      {!config && !error && <p>Loading config…</p>}
      {error && (
        <p style={{ color: 'crimson' }}>Failed to load config.json: {error}</p>
      )}
      {config && !apiKey && (
        <LoginPage config={config} onLoggedIn={handleLoggedIn} />
      )}
      {config && apiKey && (
        <HomePage config={config} apiKey={apiKey} onLogout={handleLogout} />
      )}
    </div>
  )
}
