export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export class ApiError extends Error {
  readonly status: number
  readonly body?: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export type MessageResponse = { message: string }
export type ErrorResponse = { error: string }

export type WorkoutSetWire = {
  workoutId: string
  timestamp: string
  exercise: string
  reps: string
  sets: string
  weight: string
  weight_modulation?: string
}

export type WorkoutSet = {
  workoutId: string
  timestamp: number
  exercise: string
  reps: string
  setNumber: number
  weight: number
  weightModulation?: string
}

export type WeightEntryWire = { timestamp: string; weight: string }
export type WeightEntry = { timestamp: number; weight: number }

export type WeightTrend = { date: string; slope: number }

export type InjuryEntryWire = {
  timestamp: string
  location: string
  active: string
  details?: string
}
export type InjuryEntry = {
  timestamp: number
  location: string
  active: boolean
  details?: string
}

export type AddExerciseRequest = { exercise_name: string }
export type DeleteExerciseRequest = { exercise_name: string }

export type LogSetRequest = {
  exercise: string
  reps: string
  weight: number
  isCutting?: boolean
  timestamp?: number
  // backend generally computes set number, but can be specified
  sets?: number
}

export type BatchLogSetsRequest = { sets: LogSetRequest[] }

export type EditSetRequest = {
  workoutId: string
  timestamp: number
  reps?: string | null
  sets?: number | null
  weight?: number | null
}

export type DeleteSetRequest = { workoutId: string; timestamp: number }

export type LogWeightRequest = { weight: number }

export type InjuryRequest = {
  timestamp?: number
  location: string
  details?: string
  active?: boolean
}

export type UpdateInjuryActiveRequest = { timestamp: number; active: boolean }

export type AddBodypartRequest = { location: string }
export type DeleteBodypartRequest = { location: string }

export class GainsIQApiClient {
  private readonly baseURL: string
  private readonly apiKey: string

  constructor(baseURL: string, apiKey: string) {
    this.baseURL = baseURL.replace(/\/+$/, '')
    this.apiKey = apiKey
  }

  // Core request helper
  private async request<T>(endpoint: string, method: HttpMethod, body?: unknown): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
    }
    const init: RequestInit = { method, headers }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }

    const started = performance.now()
    let res: Response
    try {
      res = await fetch(url, init)
    } catch (e) {
      throw new ApiError(0, `Network error: ${String((e as Error)?.message || e)}`)
    }
    const durationMs = Math.round(performance.now() - started)

    const text = await res.text()
    const maybeJson = text.length ? safeJsonParse(text) : undefined

    if (!res.ok) {
      const message = extractErrorMessage(maybeJson) || `HTTP ${res.status}`
      throw new ApiError(res.status, message, maybeJson ?? text)
    }

    // eslint-disable-next-line no-console
    console.debug(`[GainsIQ] ${method} ${endpoint} -> ${res.status} (${durationMs}ms)`) // no PII
    return (maybeJson as T) as T
  }

  async getExercises(): Promise<string[]> {
    const data = await this.request<string[] | null>('/exercises', 'GET')
    return data ?? []
  }
  async addExercise(exerciseName: string): Promise<void> {
    await this.request<MessageResponse>('/exercises', 'POST', { exercise_name: exerciseName } satisfies AddExerciseRequest)
  }
  async deleteExercise(exerciseName: string): Promise<void> {
    await this.request<MessageResponse>('/exercises', 'DELETE', { exercise_name: exerciseName } satisfies DeleteExerciseRequest)
  }

  async logWorkoutSet(req: LogSetRequest): Promise<void> {
    await this.request<MessageResponse>('/sets/log', 'POST', req)
  }
  async batchLogSets(req: BatchLogSetsRequest): Promise<void> {
    await this.request<MessageResponse>('/sets/batch', 'POST', req)
  }
  async getLastMonthSets(): Promise<WorkoutSet[]> {
    const data = await this.request<WorkoutSetWire[] | null>('/sets/last_month', 'GET')
    return (data ?? []).map(mapWorkoutSetWire)
  }
  async getSets(start: number, end: number): Promise<WorkoutSet[]> {
    const data = await this.request<WorkoutSetWire[] | null>(`/sets?start=${start}&end=${end}`, 'GET')
    return (data ?? []).map(mapWorkoutSetWire)
  }
  async getSetsByExercise(exerciseName: string, start: number, end: number): Promise<WorkoutSet[]> {
    const encoded = encodeURIComponent(exerciseName)
    const data = await this.request<WorkoutSetWire[] | null>(`/sets/by_exercise?exerciseName=${encoded}&start=${start}&end=${end}`, 'GET')
    return (data ?? []).map(mapWorkoutSetWire)
  }
  async editSet(req: EditSetRequest): Promise<void> {
    await this.request<MessageResponse>('/sets/edit', 'PUT', req)
  }
  async deleteSet(workoutId: string, timestamp: number): Promise<void> {
    await this.request<MessageResponse>('/sets', 'DELETE', { workoutId, timestamp } satisfies DeleteSetRequest)
  }
  async popLastSet(): Promise<string> {
    const res = await this.request<MessageResponse>('/sets/pop', 'POST')
    return res.message
  }

  async logWeight(weight: number): Promise<void> {
    await this.request<MessageResponse>('/weight', 'POST', { weight } satisfies LogWeightRequest)
  }
  async getWeights(): Promise<WeightEntry[]> {
    const data = await this.request<WeightEntryWire[] | null>('/weight', 'GET')
    return (data ?? []).map(w => ({ timestamp: toNumber(w.timestamp), weight: toNumber(w.weight) }))
  }
  async deleteRecentWeight(): Promise<string> {
    const res = await this.request<MessageResponse>('/weight', 'DELETE')
    return res.message
  }
  async getWeightTrend(): Promise<WeightTrend> {
    return await this.request<WeightTrend>('/weight/trend', 'GET')
  }

  async getInjuries(): Promise<InjuryEntry[]> {
    const data = await this.request<InjuryEntryWire[] | null>('/injury', 'GET')
    return (data ?? []).map(mapInjuryWire)
  }
  async getActiveInjuries(): Promise<InjuryEntry[]> {
    const data = await this.request<InjuryEntryWire[] | null>('/injury/active', 'GET')
    return (data ?? []).map(mapInjuryWire)
  }
  async logInjury(req: InjuryRequest): Promise<void> {
    await this.request<MessageResponse>('/injury', 'POST', req)
  }
  async setInjuryActive(timestamp: number, active: boolean): Promise<void> {
    await this.request<MessageResponse>('/injury/active', 'PUT', { timestamp, active } satisfies UpdateInjuryActiveRequest)
  }

  async getBodyparts(): Promise<string[]> {
    const data = await this.request<string[] | null>('/bodyparts', 'GET')
    return data ?? []
  }
  async addBodypart(location: string): Promise<void> {
    await this.request<MessageResponse>('/bodyparts', 'POST', { location } satisfies AddBodypartRequest)
  }
  async deleteBodypart(location: string): Promise<void> {
    await this.request<MessageResponse>('/bodyparts', 'DELETE', { location } satisfies DeleteBodypartRequest)
  }
}

function safeJsonParse(input: string): unknown | undefined {
  try {
    return JSON.parse(input)
  } catch {
    return undefined
  }
}

function extractErrorMessage(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'error' in body && typeof (body as any).error === 'string') {
    return (body as any).error as string
  }
  return undefined
}

function toNumber(v: string | number | undefined | null): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : NaN
  }
  return NaN
}

function mapWorkoutSetWire(w: WorkoutSetWire): WorkoutSet {
  return {
    workoutId: w.workoutId,
    timestamp: toNumber(w.timestamp),
    exercise: w.exercise,
    reps: w.reps,
    setNumber: toNumber(w.sets),
    weight: toNumber(w.weight),
    weightModulation: w.weight_modulation,
  }
}

function mapInjuryWire(w: InjuryEntryWire): InjuryEntry {
  return {
    timestamp: toNumber(w.timestamp),
    location: w.location,
    active: String(w.active).toLowerCase() === 'true',
    details: w.details,
  }
}

export function makeGainsIQClientFromConfig(config: { apiBaseUrl: string }, apiKey: string): GainsIQApiClient {
  return new GainsIQApiClient(config.apiBaseUrl, apiKey)
}

