import React, { useEffect, useState } from 'react'
import { GainsIQApiClient } from './api'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { HistoryPage } from './pages/HistoryPage'
import { WeightPage } from './pages/WeightPage'

type AppConfig = {
  apiBaseUrl: string
  env?: string
}

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [tab, setTab] = useState<'home' | 'history' | 'weight'>('home')

  useEffect(() => {
    const override = localStorage.getItem('gainsiq.apiBaseUrlOverride')
    // Prefer explicit local override
    if (override) {
      setConfig({ apiBaseUrl: override, env: 'local-override' })
      return
    }
    // Local development (vite dev or preview on localhost): allow Vite env override
    const envApi = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined
    const isDev = (import.meta as any).env?.DEV
    const isLocalHost = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
    if (envApi && (isDev || isLocalHost)) {
      setConfig({ apiBaseUrl: envApi, env: isDev ? 'dev-env' : 'local-env' })
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
        <>
          <div style={{ display: 'flex', gap: 8, margin: '8px 0', alignItems: 'center' }}>
            <button onClick={() => setTab('home')} style={tabBtn(tab === 'home')}>Track</button>
            <button onClick={() => setTab('history')} style={tabBtn(tab === 'history')}>History</button>
            <button onClick={() => setTab('weight')} style={tabBtn(tab === 'weight')}>Weight</button>
            <div style={{ marginLeft: 'auto' }}>
              <button onClick={handleLogout} style={logoutBtn}>Log out</button>
            </div>
          </div>
          {tab === 'home' && <HomePage config={config} apiKey={apiKey} onLogout={handleLogout} />}
          {tab === 'history' && <HistoryPage config={config} apiKey={apiKey} />}
          {tab === 'weight' && <WeightPage config={config} apiKey={apiKey} />}
        </>
      )}
    </div>
  )
}

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: 10,
    border: `1px solid ${active ? '#111' : '#ddd'}`,
    background: active ? '#111' : '#f5f5f5',
    color: active ? '#fff' : '#111',
  }
}

const logoutBtn: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  borderRadius: 10,
  border: '1px solid #ddd',
  background: '#f5f5f5',
}
