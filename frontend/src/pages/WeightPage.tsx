import React, { useEffect, useMemo, useState } from 'react'
import { GainsIQApiClient, WeightEntry, WeightTrend } from '../api'

type AppConfig = { apiBaseUrl: string; env?: string }

type Props = {
  config: AppConfig
  apiKey: string
}

export const WeightPage: React.FC<Props> = ({ config, apiKey }) => {
  const client = useMemo(() => new GainsIQApiClient(config.apiBaseUrl, apiKey), [config.apiBaseUrl, apiKey])

  const [unit, setUnit] = useState<'lbs' | 'kg'>(() => (localStorage.getItem('gainsiq.unit') as any) || 'lbs')
  const [entries, setEntries] = useState<WeightEntry[]>([])
  const [trend, setTrend] = useState<WeightTrend | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [currentWeight, setCurrentWeight] = useState('')

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    localStorage.setItem('gainsiq.unit', unit)
  }, [unit])

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const [ws, tr] = await Promise.all([
        client.getWeights(),
        client.getWeightTrend().catch(() => null as any),
      ])
      ws.sort((a, b) => a.timestamp - b.timestamp)
      setEntries(ws)
      setTrend(tr)
    } catch (e: any) {
      setError(e?.message || 'Failed to load weight data')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = isValidWeight(currentWeight)

  async function logCurrentWeight() {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const n = Number(currentWeight)
      const lbs = unit === 'kg' ? n * 2.20462 : n
      await client.logWeight(Number(lbs.toFixed(2)))
      setCurrentWeight('')
      await reload()
      setSuccess('Weight logged')
    } catch (e: any) {
      setError(e?.message || 'Failed to log weight')
    } finally {
      setLoading(false)
    }
  }

  async function deleteRecent() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const msg = await client.deleteRecentWeight()
      await reload()
      setSuccess(msg || 'Deleted most recent entry')
    } catch (e: any) {
      setError(e?.message || 'Failed to delete weight')
    } finally {
      setLoading(false)
    }
  }

  const displayEntries = entries.slice(-60) // last ~60 points
  const chartPoints = toSparklinePoints(displayEntries.map((e) => toUnit(e.weight, unit)))

  const weeklyChange = trend ? trend.slope * 7 : null // slope is lbs/day from backend

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '8px 0' }}>Track Your Weight</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: '#555', fontSize: 14 }}>
          <div>
            <span style={{ color: '#777' }}>Unit: </span>
            <strong>{unit.toUpperCase()}</strong>
          </div>
          {entries.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
              <span>Entries: {entries.length}</span>
              <span>Avg: {formatOne(avg(entries.map((e) => toUnit(e.weight, unit))))} {unit}</span>
            </div>
          )}
        </div>
      </div>

      {/* Form */}
      <div style={cardStyle}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Current Weight ({unit})</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            inputMode="decimal"
            placeholder={`Enter weight in ${unit}`}
            value={currentWeight}
            onChange={(e) => setCurrentWeight(e.target.value)}
            style={inputStyle}
          />
          <button onClick={logCurrentWeight} disabled={!canSubmit || loading} style={primaryBtn}>
            {loading ? 'Working…' : 'Log'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <span style={{ color: '#777' }}>Unit</span>
          <button style={toggleBtn(unit === 'lbs')} onClick={() => setUnit('lbs')}>lbs</button>
          <button style={toggleBtn(unit === 'kg')} onClick={() => setUnit('kg')}>kg</button>
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={deleteRecent} disabled={loading || entries.length === 0} style={warnBtnSmall}>Delete Recent</button>
          </div>
        </div>
      </div>

      {/* Trend */}
      {trend && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>Weight Trend</div>
            <div style={{ color: '#777', fontSize: 12 }}>as of {trend.date}</div>
          </div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: weeklyChange && weeklyChange >= 0 ? '#1565C0' : '#C62828' }}>
              {weeklyChange !== null ? formatOne(toUnit(weeklyChange, unit)) : '—'} {unit}/wk
            </div>
            <div style={{ color: '#777' }}>
              ({formatOne(toUnit(trend.slope, unit))} {unit}/day)
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Weight Progress</div>
        {chartPoints.length >= 2 ? (
          <svg viewBox="0 0 300 120" width="100%" height="120">
            <rect x="0" y="0" width="300" height="120" fill="#f1f3f5" rx="8" />
            <polyline
              fill="none"
              stroke="#1565C0"
              strokeWidth="2"
              points={chartPoints.map((p) => `${p.x},${p.y}`).join(' ')}
            />
          </svg>
        ) : (
          <div style={{ color: '#777', fontStyle: 'italic' }}>Not enough data</div>
        )}
      </div>

      {/* Recent entries */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Recent Entries</div>
        {entries.length === 0 ? (
          <div style={{ color: '#777', fontStyle: 'italic' }}>No weight entries yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.slice().reverse().slice(0, 15).map((e) => (
              <div key={e.timestamp} style={entryRow}>
                <div>
                  <div style={{ fontWeight: 600 }}>{formatOne(toUnit(e.weight, unit))} {unit}</div>
                  <div style={muted}>{formatDateTime(e.timestamp)} · {timeAgo(e.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div style={{ color: 'crimson', marginTop: 12 }}>{error}</div>}
      {success && <div style={{ color: 'seagreen', marginTop: 12 }}>{success}</div>}
    </div>
  )
}

// Helpers
function isValidWeight(v: string) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0
}

function toUnit(lbs: number, unit: 'lbs' | 'kg'): number {
  return unit === 'kg' ? lbs / 2.20462 : lbs
}

function formatOne(n: number | null): string {
  if (n === null) return '—'
  return n.toFixed(1)
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function toSparklinePoints(values: number[]): { x: number; y: number }[] {
  if (values.length < 2) return []
  const w = 300
  const h = 120
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = w / (values.length - 1)
  return values.map((v, i) => ({
    x: Math.round(i * stepX),
    y: Math.round(h - ((v - min) / span) * (h - 8) - 4),
  }))
}

function formatDateTime(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(ts: number): string {
  const seconds = Math.max(1, Math.floor(Date.now() / 1000 - ts))
  const units: [number, string][] = [
    [60, 's'],
    [60, 'm'],
    [24, 'h'],
    [7, 'd'],
    [4.345, 'w'],
    [12, 'mo'],
  ]
  let val = seconds
  let unit = 's'
  for (const [k, u] of units) {
    if (val < k) break
    val = Math.floor(val / k)
    unit = u
  }
  return `${val}${unit} ago`
}

const cardStyle: React.CSSProperties = {
  padding: 14,
  background: '#f7f7f9',
  borderRadius: 12,
  border: '1px solid #eee',
  marginBottom: 12,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 12px',
  fontSize: 16,
  borderRadius: 10,
  border: '1px solid #ddd',
  background: '#fff',
}

const primaryBtn: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 16,
  borderRadius: 10,
  border: '1px solid #111',
  background: '#111',
  color: '#fff',
}

const warnBtnSmall: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 14,
  borderRadius: 10,
  border: '1px solid #e65100',
  background: '#ef6c00',
  color: '#fff',
}

function toggleBtn(active: boolean): React.CSSProperties {
  return {
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: 10,
    border: `1px solid ${active ? '#1565C0' : '#ddd'}`,
    background: active ? '#e9f2ff' : '#f5f5f5',
    color: active ? '#0d47a1' : '#111',
  }
}

const entryRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 10px',
  background: '#fff',
  border: '1px solid #eee',
  borderRadius: 8,
}

const muted: React.CSSProperties = { color: '#777', fontSize: 12 }

export default WeightPage

