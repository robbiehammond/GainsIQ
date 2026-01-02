import React, { useEffect, useMemo, useState } from 'react'
import { GainsIQApiClient } from '../api'

type AppConfig = {
  apiBaseUrl: string
  env?: string
}

type Props = {
  config: AppConfig
  onLoggedIn: (apiKey: string) => void
}

export const LoginPage: React.FC<Props> = ({ config, onLoggedIn }) => {
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('gainsiq.apiKey')
    if (saved) setApiKey(saved)
  }, [])

  const client = useMemo(() => new GainsIQApiClient(config.apiBaseUrl, apiKey || ''), [config.apiBaseUrl, apiKey])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!apiKey.trim()) {
      setError('API key is required')
      return
    }
    setLoading(true)
    try {
      // Lightweight validation: attempt GET /exercises
      await client.getExercises()
      onLoggedIn(apiKey.trim())
    } catch (err: any) {
      const msg = (err?.message as string) || 'Login failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} style={containerStyle}>
      <div style={{ marginBottom: 8, color: '#555', fontSize: 14 }}>Environment: {config.env ?? 'unknown'}</div>
      <div style={{ marginBottom: 16, color: '#555', fontSize: 14, wordBreak: 'break-all' }}>API: {config.apiBaseUrl}</div>

      <label style={labelStyle} htmlFor="apiKey">API Key</label>
      <div style={inputRowStyle}>
        <input
          id="apiKey"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          type={show ? 'text' : 'password'}
          placeholder="Paste your API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={inputStyle}
        />
        <button type="button" onClick={() => setShow((s) => !s)} style={toggleStyle} aria-label={show ? 'Hide key' : 'Show key'}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      <button type="submit" disabled={loading} style={submitStyle}>
        {loading ? 'Verifying…' : 'Continue'}
      </button>

      <p style={footnoteStyle}>We’ll add account creation later.</p>
    </form>
  )
}

const containerStyle: React.CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
}

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  marginBottom: 6,
}

const inputRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  marginBottom: 12,
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '14px 12px',
  fontSize: 16,
  borderRadius: 10,
  border: '1px solid #ddd',
}

const toggleStyle: React.CSSProperties = {
  padding: '12px 12px',
  fontSize: 14,
  borderRadius: 10,
  border: '1px solid #ddd',
  background: '#f5f5f5',
}

const submitStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  fontSize: 16,
  borderRadius: 10,
  border: '1px solid #222',
  background: '#111',
  color: '#fff',
}

const errorStyle: React.CSSProperties = {
  color: 'crimson',
  marginBottom: 12,
}

const footnoteStyle: React.CSSProperties = {
  color: '#666',
  fontSize: 13,
  marginTop: 12,
}

export default LoginPage

