export interface Set {
    exercise: string;
    weight: number;
    reps: string;
    setNumber?: number;
    timestamp?: number;
    workoutId?: string;
    weight_modulation?: string;
}

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

export interface WeightEntryData {
    timestamp: string;
    weight: number;
}

export type WeightUnit = 'lbs' | 'kg';
export type CuttingState = 'CUTTING' | 'BULKING';

export interface WorkoutFormState {
    selectedExercise: string;
    reps: string;
    weight: string;
}

export interface WeightUnitState {
    weightUnit: WeightUnit;
}

export interface CuttingStateState {
    cuttingState: CuttingState;
}

export class SetUtils {
    static fromBackend(item: any): Set {
        return {
            workoutId: item.workoutId,
            exercise: item.exercise,
            weight: item.weight,
            reps: item.reps,
            setNumber: item.sets, 
            timestamp: item.timestamp, 
            weight_modulation: item.weight_modulation
        };
    }

    static toBackend(set: Set): any {
        return {
            exercise: set.exercise,
            weight: set.weight,
            reps: set.reps,
            sets: set.setNumber, 
            timestamp: set.timestamp, 
        };
    }
}