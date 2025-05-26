// GainsIQClient.ts
import { AddSetRequest, AddSetResponse, WorkoutSet } from "./types";

export class GainsIQClient {
  private apiUrl: string;
  private apiKey?: string;

  constructor(apiUrl: string, apiKey?: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (this.apiKey) {
      headers.set("x-api-key", this.apiKey)
    }

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }

  // === Exercises endpoints ===
  async getExercises(): Promise<string[]> {
    return this.request<string[]>("/exercises", { method: "GET" });
  }

  async addExercise(exerciseName: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/exercises", {
      method: "POST",
      body: JSON.stringify({ exercise_name: exerciseName }),
    });
  }

  // === Workout sets endpoints ===
  async logWorkoutSet(data: {
    exercise: string;
    reps: string;
    sets: number;
    weight: number;
    isCutting: boolean;
  }): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/sets/log", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async popLastSet(): Promise<{ message: string }> {
    return this.request<{ message: string }>("/sets/pop", { method: "POST" });
  }

  async getLastMonthWorkouts(): Promise<WorkoutSet[]> {
    return this.request<WorkoutSet[]>("/sets/last_month", { method: "GET" });
  }

  async editSet(payload: {
    workoutId: string;
    timestamp: number;
    exercise: string;
    reps: string;
    sets: number;
    weight: number;
  }): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/sets/edit", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteSet(payload: { workoutId: string; timestamp: number }): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/sets", {
      method: "DELETE",
      body: JSON.stringify(payload),
    });
  }

  async getSetsByExercise(params: { exerciseName: string; start: number; end: number }): Promise<WorkoutSet[]> {
    const queryParams = new URLSearchParams({
      exerciseName: params.exerciseName,
      start: params.start.toString(),
      end: params.end.toString(),
    }).toString();
    return this.request<WorkoutSet[]>(`/sets/by_exercise?${queryParams}`, { method: "GET" });
  }
  
  /**
   * Fetch all workout sets between start and end timestamps (inclusive).
   */
  async getSets(params: { start: number; end: number }): Promise<WorkoutSet[]> {
    const queryParams = new URLSearchParams({
      start: params.start.toString(),
      end: params.end.toString(),
    }).toString();
    return this.request<WorkoutSet[]>(`/sets?${queryParams}`, { method: "GET" });
  }

  // === Weight endpoints ===
  async getWeights(): Promise<{ weight: number; timestamp: string }[]> {
    return this.request<{ weight: number; timestamp: string }[]>("/weight", { method: "GET" });
  }

  async logWeight(weight: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/weight", {
      method: "POST",
      body: JSON.stringify({ weight }),
    });
  }

  async deleteMostRecentWeight(): Promise<{ message: string }> {
    return this.request<{ message: string }>("/weight", { method: "DELETE" });
  }

  // === Analysis endpoint ===
  async generateAnalysis(): Promise<any> {
    return this.request<any>("/analysis", { method: "POST" });
  }

  async fetchAnalysis(): Promise<any> {
    return this.request<any>("/analysis", { method: "GET" });
  }
}