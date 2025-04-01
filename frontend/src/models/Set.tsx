export interface Set {
    exercise: string;
    weight: number;
    reps: string;
    setNumber: number;
    timestamp?: number;
    workoutId?: string;
    weight_modulation?: string;
}

export class SetUtils {
    // Once the "sets" column is renamed, this can be removed.
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

    // Same comment as above.
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