export interface WorkoutSet {
    id: string;
    exercise: string;
    weight: number;
    reps: number;
    timestamp: string;
    weight_modulation?: string;
  }
  
  export interface AddSetRequest {
    exercise: string;
    weight: number;
    reps: number;
  }
  
  export interface AddSetResponse {
    success: boolean;
    setId: string;
  }