import React, { useEffect, useMemo, useState } from 'react'
import { GainsIQApiClient, WorkoutSet } from '../api'

type AppConfig = { apiBaseUrl: string; env?: string }

type Props = {
  config: AppConfig
  apiKey: string
}

export const HistoryPage: React.FC<Props> = ({ config, apiKey }) => {
  const client = useMemo(() => new GainsIQApiClient(config.apiBaseUrl, apiKey), [config.apiBaseUrl, apiKey])

  const [selectedDate, setSelectedDate] = useState<string>(() => formatDateInputValue(new Date()))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [editing, setEditing] = useState<WorkoutSet | null>(null)
  const [editReps, setEditReps] = useState('')
  const [editWeight, setEditWeight] = useState('')

  // TODO: Change from local storage to some other state management system.
  // Display unit preference (lbs|kg) stored by HomePage
  const [unit, setUnit] = useState<'lbs' | 'kg'>(() => (localStorage.getItem('gainsiq.unit') as any) || 'lbs')

  useEffect(() => {
    void loadForDate(selectedDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadForDate(dateStr: string) {
    setLoading(true)
    setError(null)
    try {
      const [start, end] = dayRange(dateStr)
      const rows = await client.getSets(start, end)
      rows.sort((a, b) => a.timestamp - b.timestamp)
      setSets(rows)
    } catch (e: any) {
      setError(e?.message || 'Failed to load sets')
    } finally {
      setLoading(false)
    }
  }

  const hasData = sets.length > 0
  const stats = computeStats(sets)

  function startEditing(s: WorkoutSet) {
    setEditing(s)
    setEditReps(s.reps)
    setEditWeight(displayWeight(s.weight, unit))
  }

  function cancelEdit() {
    setEditing(null)
    setEditReps('')
    setEditWeight('')
  }

  async function saveEdit() {
    if (!editing) return
    const weightNum = Number(editWeight)
    if (editWeight && (!Number.isFinite(weightNum) || weightNum <= 0)) {
      setError('Invalid weight')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const weightLbs = unit === 'kg' ? weightNum * 2.20462 : weightNum
      await client.editSet({
        workoutId: editing.workoutId,
        timestamp: editing.timestamp,
        reps: editReps ? editReps : null,
        weight: editWeight ? Number(weightLbs.toFixed(2)) : null,
      })
      // Refresh
      await loadForDate(selectedDate)
      cancelEdit()
    } catch (e: any) {
      setError(e?.message || 'Failed to save changes')
    } finally {
      setLoading(false)
    }
  }

  async function deleteSet(s: WorkoutSet) {
    setLoading(true)
    setError(null)
    try {
      await client.deleteSet(s.workoutId, s.timestamp)
      await loadForDate(selectedDate)
    } catch (e: any) {
      setError(e?.message || 'Failed to delete set')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      {/* Date picker */}
      <div style={cardStyle}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Select Date</div>
        <input
          type="date"
          value={selectedDate}
          onChange={async (e) => {
            const v = e.target.value
            setSelectedDate(v)
            await loadForDate(v)
          }}
          style={inputStyle}
        />
        {hasData && (
          <div style={statsRow}>
            <span>Sets: {stats.count}</span>
            <span>Exercises: {stats.exercises}</span>
            <span>Volume: {formatNumber(stats.volume)} {unit}</span>
          </div>
        )}
      </div>

      <hr style={{ border: 0, borderTop: '1px solid #eee', margin: '8px 0 12px' }} />

      {loading ? (
        <div style={centerBox}>Loading workouts…</div>
      ) : hasData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sets.map((s) => (
            <div key={`${s.workoutId}-${s.timestamp}`} style={rowCard}>
              <div style={rowHeader}>
                <div style={{ fontWeight: 600 }}>{s.exercise}</div>
                <div style={setPill}>Set #{s.setNumber}</div>
              </div>
              <div style={rowDetails}>
                <div>
                  <div>{s.reps} reps</div>
                  <div style={{ color: '#1565C0', fontWeight: 600 }}>{displayWeight(s.weight, unit)} {unit}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div>{formatTime(s.timestamp)}</div>
                  {s.weightModulation && (
                    <div style={{ fontSize: 12, color: s.weightModulation.toLowerCase() === 'cutting' ? '#C62828' : '#1565C0' }}>{s.weightModulation}</div>
                  )}
                </div>
              </div>

              <div style={rowActions}>
                <button style={linkBtn} onClick={() => startEditing(s)}>Edit</button>
                <button style={{ ...linkBtn, color: '#C62828' }} onClick={() => deleteSet(s)}>Delete</button>
              </div>

              {editing && editing.workoutId === s.workoutId && editing.timestamp === s.timestamp && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Reps"
                      value={editReps}
                      onChange={(e) => setEditReps(e.target.value)}
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder={`Weight (${unit})`}
                      value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={saveEdit} style={primaryBtnSmall}>Save Changes</button>
                    <button onClick={cancelEdit} style={secondaryBtn}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={centerBox}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>No workouts found</div>
          <div>No workouts logged for {selectedDate}</div>
        </div>
      )}

      {error && <div style={{ color: 'crimson', marginTop: 12 }}>{error}</div>}
    </div>
  )
}

function dayRange(dateStr: string): [number, number] {
  const d = new Date(dateStr + 'T00:00:00')
  const start = Math.floor(d.getTime() / 1000)
  const end = Math.floor(new Date(d.getTime() + 24 * 3600 * 1000).getTime() / 1000)
  return [start, end]
}

function formatDateInputValue(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function parseRepsToNumber(reps: string): number {
  const token = reps.split(' ')[0]
  const n = Number(token)
  return Number.isFinite(n) ? n : 0
}

function computeStats(sets: WorkoutSet[]): { count: number; exercises: number; volume: number } {
  const count = sets.length
  const exerciseSet = new Set(sets.map((s) => s.exercise))
  const exercises = exerciseSet.size
  const volume = sets.reduce((acc, s) => acc + parseRepsToNumber(s.reps) * s.weight, 0)
  return { count, exercises, volume }
}

function displayWeight(weightLbs: number, unit: 'lbs' | 'kg'): string {
  if (unit === 'kg') return (weightLbs / 2.20462).toFixed(1)
  return weightLbs.toFixed(1)
}

function formatNumber(n: number): string {
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
}

const cardStyle: React.CSSProperties = {
  padding: 14,
  background: '#f7f7f9',
  borderRadius: 12,
  border: '1px solid #eee',
}

const rowCard: React.CSSProperties = {
  padding: 12,
  background: '#f7f7f9',
  borderRadius: 12,
  border: '1px solid #eee',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 12px',
  fontSize: 16,
  borderRadius: 10,
  border: '1px solid #ddd',
  background: '#fff',
}

const statsRow: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  justifyContent: 'space-between',
  marginTop: 8,
  color: '#666',
  fontSize: 13,
}

const centerBox: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 160,
  color: '#666',
}

const rowHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 6,
}

const rowDetails: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
}

const setPill: React.CSSProperties = {
  fontSize: 12,
  color: '#555',
  padding: '2px 8px',
  background: '#eee',
  borderRadius: 6,
}

const rowActions: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 8,
}

const linkBtn: React.CSSProperties = {
  fontSize: 14,
  color: '#1565C0',
  background: 'transparent',
  border: 'none',
}

const primaryBtnSmall: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  borderRadius: 10,
  border: '1px solid #111',
  background: '#111',
  color: '#fff',
}

const secondaryBtn: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  borderRadius: 10,
  border: '1px solid #ddd',
  background: '#f5f5f5',
}

export default HistoryPage

