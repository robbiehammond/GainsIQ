import React, { useEffect, useMemo, useState } from 'react'
import { GainsIQApiClient, WorkoutSet } from '../api'

type AppConfig = { apiBaseUrl: string; env?: string }

type Props = {
  config: AppConfig
  apiKey: string
  onLogout: () => void
}

type Phase = 'cutting' | 'bulking'
type Unit = 'lbs' | 'kg'

const KG_TO_LB = 2.20462
const defaultRepOptions: string[] = Array.from({length: 20}, (_, i) => (6 + i)).map(String)

export const HomePage: React.FC<Props> = ({ config, apiKey, onLogout }) => {
  const client = useMemo(() => new GainsIQApiClient(config.apiBaseUrl, apiKey), [config.apiBaseUrl, apiKey])

  const [phase, setPhase] = useState<Phase>(() => (localStorage.getItem('gainsiq.phase') as Phase) || 'bulking')
  const [unit, setUnit] = useState<Unit>(() => (localStorage.getItem('gainsiq.unit') as Unit) || 'lbs')
  const [customTime, setCustomTime] = useState<boolean>(false)
  const [customDatetime, setCustomDatetime] = useState<string>('') // yyyy-MM-ddTHH:mm

  const [exercises, setExercises] = useState<string[]>([])
  const [searchText, setSearchText] = useState('')
  const [selectedExercise, setSelectedExercise] = useState<string>(() => localStorage.getItem('gainsiq.selectedExercise') || '')
  const [repOptions] = useState<string[]>(defaultRepOptions)
  const [reps, setReps] = useState<string>('')
  const [weightStr, setWeightStr] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [newExerciseName, setNewExerciseName] = useState('')

  useEffect(() => {
    void reloadExercises()
  }, [])

  useEffect(() => {
    localStorage.setItem('gainsiq.phase', phase)
  }, [phase])
  useEffect(() => {
    localStorage.setItem('gainsiq.unit', unit)
  }, [unit])
  useEffect(() => {
    localStorage.setItem('gainsiq.selectedExercise', selectedExercise)
  }, [selectedExercise])

  const filteredExercises = exercises.filter((e) => e.toLowerCase().includes(searchText.toLowerCase()))

  async function reloadExercises() {
    setError(null)
    try {
      const list = await client.getExercises()
      setExercises(list)
    } catch (e: any) {
      setError(e?.message || 'Failed to load exercises')
    }
  }

  const canSubmit = selectedExercise.trim().length > 0 && reps.trim().length > 0 && isValidWeight(weightStr)

  function isValidWeight(v: string) {
    const n = Number(v)
    return Number.isFinite(n) && n > 0
  }

  function toUnixSeconds(dtLocal: string): number | undefined {
    if (!dtLocal) return undefined
    const ms = Date.parse(dtLocal)
    if (!Number.isFinite(ms)) return undefined
    return Math.floor(ms / 1000)
  }

  async function handleLogSet() {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const weightVal = Number(weightStr)
      const weightLbs = unit === 'kg' ? weightVal * KG_TO_LB : weightVal
      const timestamp = customTime ? toUnixSeconds(customDatetime) : undefined
      await client.logWorkoutSet({
        exercise: selectedExercise,
        reps,
        weight: Number(weightLbs.toFixed(2)),
        isCutting: phase === 'cutting',
        timestamp,
      })
      setSuccess('Workout set logged')
      setReps('')
      setWeightStr('')
    } catch (e: any) {
      setError(e?.message || 'Failed to log set')
    } finally {
      setLoading(false)
    }
  }

  async function handlePopLast() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const msg = await client.popLastSet()
      setSuccess(msg || 'Popped last set')
    } catch (e: any) {
      setError(e?.message || 'Failed to pop last set')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddExercise() {
    if (!newExerciseName.trim()) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await client.addExercise(newExerciseName.trim())
      await reloadExercises()
      setSelectedExercise(newExerciseName.trim())
      setShowAddExercise(false)
      setNewExerciseName('')
      setSuccess('Exercise added')
    } catch (e: any) {
      setError(e?.message || 'Failed to add exercise')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '8px 0' }}>Log Your Workout</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: '#555', fontSize: 14 }}>
          <div>
            <span style={{ color: '#777' }}>Phase: </span>
            <strong style={{ color: phase === 'cutting' ? '#C62828' : '#1565C0' }}>{phase === 'cutting' ? 'Cutting' : 'Bulking'}</strong>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ color: '#777' }}>Unit: </span>
            <strong>{unit.toUpperCase()}</strong>
          </div>
        </div>
      </div>

      {/* Main form */}
      <div style={cardStyle}>
        {/* Exercise selector */}
        <div style={{ marginBottom: 14 }}>
          <div style={sectionTitle}>Exercise</div>
          {exercises.length === 0 ? (
            <div style={{ color: '#777', fontStyle: 'italic' }}>Loading exercises…</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Search exercises…"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={inputStyle}
                />
                <button style={secondaryBtn} onClick={reloadExercises} disabled={loading}>Refresh</button>
              </div>

              {selectedExercise && (
                <div style={pillRow}>
                  <span style={{ color: '#777' }}>Selected:&nbsp;</span>
                  <strong>{selectedExercise}</strong>
                  <button style={linkBtn} onClick={() => setSelectedExercise('')}>Clear</button>
                </div>
              )}

              {(!selectedExercise || searchText) && (
                <div style={listBox}>
                  {(filteredExercises.length ? filteredExercises : exercises).slice(0, 50).map((name) => (
                    <button
                      key={name}
                      onClick={() => {
                        setSelectedExercise(name)
                        setSearchText('')
                      }}
                      style={{ ...listItemBtn, background: selectedExercise === name ? '#eef6ff' : '#fff' }}
                    >
                      <span>{name}</span>
                      {selectedExercise === name && <span style={{ color: '#1565C0' }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Reps */}
        <div style={{ marginBottom: 14 }}>
          <div style={sectionTitle}>Reps</div>
          <select value={reps} onChange={(e) => setReps(e.target.value)} style={selectStyle}>
            <option value="">Select reps</option>
            {repOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Weight */}
        <div style={{ marginBottom: 14 }}>
          <div style={sectionTitle}>Weight ({unit})</div>
          <input
            type="number"
            inputMode="decimal"
            placeholder={`Enter weight in ${unit}`}
            value={weightStr}
            onChange={(e) => setWeightStr(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Settings */}
        <div style={{ marginTop: 8 }}>
          <hr style={{ border: 0, borderTop: '1px solid #eee', margin: '8px 0 12px' }} />
          <div style={rowBetween}>
            <div style={sectionTitle}>Weight Unit</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={toggleBtn(unit === 'lbs')} onClick={() => setUnit('lbs')}>lbs</button>
              <button style={toggleBtn(unit === 'kg')} onClick={() => setUnit('kg')}>kg</button>
            </div>
          </div>
          <div style={{ height: 8 }} />
          <div style={rowBetween}>
            <div style={sectionTitle}>Phase</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={toggleBtn(phase === 'bulking')} onClick={() => setPhase('bulking')}>Bulking</button>
              <button style={toggleBtn(phase === 'cutting')} onClick={() => setPhase('cutting')}>Cutting</button>
            </div>
          </div>
          <div style={{ height: 8 }} />
          <div style={rowBetween}>
            <div style={sectionTitle}>Custom Time</div>
            <button style={secondaryBtn} onClick={() => setCustomTime((s) => !s)}>{customTime ? 'Cancel' : 'Set Time'}</button>
          </div>
          {customTime && (
            <div style={{ marginTop: 8 }}>
              <input
                type="datetime-local"
                value={customDatetime}
                onChange={(e) => setCustomDatetime(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        <button onClick={handleLogSet} disabled={!canSubmit || loading} style={primaryBtn}>
          {loading ? 'Working…' : 'Log Workout'}
        </button>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handlePopLast} disabled={loading} style={warnBtn}>Pop Last Set</button>
          <button onClick={() => setShowAddExercise(true)} disabled={loading} style={successBtn}>Add Exercise</button>
        </div>
        <button onClick={onLogout} style={ghostBtn}>Log out</button>
      </div>

      {/* Add exercise modal-ish block */}
      {showAddExercise && (
        <div style={cardStyle}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Add New Exercise</div>
          <input
            type="text"
            placeholder="Exercise name"
            value={newExerciseName}
            onChange={(e) => setNewExerciseName(e.target.value)}
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button onClick={handleAddExercise} disabled={!newExerciseName.trim() || loading} style={successBtn}>Add</button>
            <button onClick={() => { setShowAddExercise(false); setNewExerciseName('') }} style={secondaryBtn}>Cancel</button>
          </div>
        </div>
      )}

      {/* Messages */}
      {error && <div style={{ color: 'crimson', marginTop: 12 }}>{error}</div>}
      {success && <div style={{ color: 'seagreen', marginTop: 12 }}>{success}</div>}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  padding: 14,
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
} as React.CSSProperties

const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 600, marginBottom: 6 }

const listBox: React.CSSProperties = {
  maxHeight: 220,
  overflow: 'auto',
  border: '1px solid #eee',
  borderRadius: 10,
}

const listItemBtn: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  border: 'none',
  background: '#fff',
}

const pillRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  background: '#f0f0f4',
  borderRadius: 8,
  marginBottom: 8,
}

const rowBetween: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  fontSize: 16,
  borderRadius: 10,
  border: '1px solid #111',
  background: '#111',
  color: '#fff',
}

const successBtn: React.CSSProperties = {
  flex: 1,
  padding: '12px 12px',
  fontSize: 16,
  borderRadius: 10,
  border: '1px solid #1b5e20',
  background: '#2e7d32',
  color: '#fff',
}

const warnBtn: React.CSSProperties = {
  flex: 1,
  padding: '12px 12px',
  fontSize: 16,
  borderRadius: 10,
  border: '1px solid #e65100',
  background: '#ef6c00',
  color: '#fff',
}

const secondaryBtn: React.CSSProperties = {
  padding: '12px 12px',
  fontSize: 14,
  borderRadius: 10,
  border: '1px solid #ddd',
  background: '#f5f5f5',
}

const ghostBtn: React.CSSProperties = {
  padding: '12px 12px',
  fontSize: 14,
  borderRadius: 10,
  border: '1px solid #ddd',
  background: '#fff',
}

const linkBtn: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: 12,
  color: '#1565C0',
  background: 'transparent',
  border: 'none',
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

export default HomePage
